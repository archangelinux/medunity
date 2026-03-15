from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException

import asyncio

from backend.models.schemas import CreateEntryRequest, RespondRequest
from backend.services.supabase import get_supabase
from backend.agent.processor import process_new_entry, resolve_entry
from backend.api.deps import get_current_user_id
from backend.api.overview import regenerate_summary

router = APIRouter(prefix="/api/entries", tags=["entries"])


def _format_timestamp(ts: str) -> str:
    """Format a timestamp string for display."""
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt.strftime("%-I:%M %p")
    except Exception:
        return ts


def _transform_entry(entry: dict, messages: list) -> dict:
    """Transform a DB entry + messages into frontend-compatible format."""
    symptoms = entry.get("extracted_symptoms") or []
    follow_up = [
        {
            "role": "agent" if m["role"] == "assistant" else "user",
            "text": m["text"],
            "timestamp": _format_timestamp(m["created_at"]),
        }
        for m in messages
    ]

    # Build linked entries
    linked_entries = []
    if entry.get("linked_entry_id"):
        linked_entries.append(
            {
                "id": entry["linked_entry_id"],
                "label": entry.get("link_reason") or "Related entry",
                "date": entry.get("created_at", "")[:10],
            }
        )

    # Build triage report if present
    triage_report = entry.get("triage_report")
    triage_report_out = None
    if triage_report:
        triage_report_out = {
            "summary": triage_report.get("summary", ""),
            "symptomsIdentified": triage_report.get("symptoms_identified", []),
            "assessment": triage_report.get("assessment", ""),
            "recommendedAction": triage_report.get("recommended_action", ""),
            "watchFor": triage_report.get("watch_for", []),
            "urgencyTimeframe": triage_report.get("urgency_timeframe", ""),
            "recommendedCareType": triage_report.get("recommended_care_type", "walk-in"),
            "recommendedFacilityTypes": triage_report.get("recommended_facility_types", [triage_report.get("recommended_care_type", "walk-in")]),
            "facilitySearchTerms": triage_report.get("facility_search_terms", []),
            "facilityExcludeKeywords": triage_report.get("facility_exclude_keywords", []),
            "patientDemographics": triage_report.get("patient_demographics", {}),
        }

    return {
        "id": entry["id"],
        "timestamp": entry["created_at"],
        "userText": entry["raw_text"],
        "symptoms": symptoms,
        "ctasLevel": entry.get("ctas_level") or 4,
        "status": entry.get("status") or "active",
        "assessment": entry.get("assessment") or "",
        "linkedEntries": linked_entries,
        "followUp": follow_up,
        "photoUrl": entry.get("photo_url"),
        "triageReport": triage_report_out,
        "triageQuestions": entry.get("triage_questions") or [],
    }


@router.post("")
async def create_entry(req: CreateEntryRequest, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()

    # Insert entry
    insert_result = (
        sb.table("entries")
        .insert({"raw_text": req.text, "user_id": user_id, "photo_url": req.photo_url})
        .execute()
    )
    entry = insert_result.data[0]
    entry_id = entry["id"]

    # Fetch recent entries for context (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    recent = (
        sb.table("entries")
        .select("*")
        .eq("user_id", user_id)
        .neq("id", entry_id)
        .gte("created_at", thirty_days_ago)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    recent_entries = recent.data or []

    # Fetch user profile for context
    profile_result = sb.table("user_profiles").select("*").eq("user_id", user_id).execute()
    user_profile = profile_result.data[0] if profile_result.data else None

    # Process with Gemini agent
    agent_result = await process_new_entry(req.text, recent_entries, user_profile)

    # Update entry with extracted symptoms and triage questions
    update_data = {
        "extracted_symptoms": agent_result["extracted_symptoms"],
        "triage_questions": agent_result.get("triage_questions", []),
    }

    # Link to previous entry if detected
    if agent_result.get("linked_entry_id"):
        for re in recent_entries:
            if re["id"] == agent_result["linked_entry_id"]:
                update_data["linked_entry_id"] = agent_result["linked_entry_id"]
                update_data["link_reason"] = agent_result.get("link_reason")
                break

    agent_text = ""
    triage_questions = agent_result.get("triage_questions", [])

    # If urgent (CTAS 1-2), resolve immediately — no triage form
    if not agent_result.get("needs_followup", True):
        resolution = await resolve_entry(
            req.text,
            agent_result["extracted_symptoms"],
            [],
            recent_entries,
            user_profile,
        )
        update_data["ctas_level"] = resolution["ctas_level"]
        update_data["ctas_label"] = resolution["ctas_label"]
        update_data["assessment"] = resolution["assessment"]
        update_data["recommended_action"] = resolution["recommended_action"]
        update_data["status"] = resolution["status"]
        # Patient demographics for report
        patient_demographics = {}
        if user_profile:
            for field in ("age", "sex"):
                if user_profile.get(field):
                    patient_demographics[field] = user_profile[field]
            for field in ("conditions", "medications", "allergies"):
                val = user_profile.get(field)
                if isinstance(val, list) and val:
                    patient_demographics[field] = val

        update_data["triage_report"] = {
            "summary": resolution.get("summary", ""),
            "symptoms_identified": resolution.get("symptoms_identified", []),
            "assessment": resolution.get("assessment", ""),
            "recommended_action": resolution.get("recommended_action", ""),
            "watch_for": resolution.get("watch_for", []),
            "urgency_timeframe": resolution.get("urgency_timeframe", ""),
            "recommended_care_type": resolution.get("recommended_care_type", "walk-in"),
            "recommended_facility_types": resolution.get("recommended_facility_types", [resolution.get("recommended_care_type", "walk-in")]),
            "facility_search_terms": resolution.get("facility_search_terms", []),
            "facility_exclude_keywords": resolution.get("facility_exclude_keywords", []),
            "patient_demographics": patient_demographics,
        }
        agent_text = "Your preliminary triage assessment is ready."
        triage_questions = []

    sb.table("entries").update(update_data).eq("id", entry_id).execute()

    if agent_text:
        sb.table("thread_messages").insert(
            {"entry_id": entry_id, "role": "assistant", "text": agent_text}
        ).execute()

    # Fetch the updated entry
    updated = sb.table("entries").select("*").eq("id", entry_id).execute()
    msgs = (
        sb.table("thread_messages")
        .select("*")
        .eq("entry_id", entry_id)
        .order("created_at")
        .execute()
    )

    # Regenerate health summary in background
    asyncio.create_task(regenerate_summary(user_id))

    return {
        "entry": _transform_entry(updated.data[0], msgs.data or []),
        "triageQuestions": triage_questions,
        "agentResponse": agent_text,
        "isResolved": not agent_result.get("needs_followup", True),
    }


@router.post("/{entry_id}/respond")
async def respond_to_entry(entry_id: str, req: RespondRequest, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()

    # Verify entry exists
    entry_result = sb.table("entries").select("*").eq("id", entry_id).execute()
    if not entry_result.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry = entry_result.data[0]

    # Store user message
    sb.table("thread_messages").insert(
        {"entry_id": entry_id, "role": "user", "text": req.message}
    ).execute()

    # Fetch full thread
    thread_result = (
        sb.table("thread_messages")
        .select("*")
        .eq("entry_id", entry_id)
        .order("created_at")
        .execute()
    )
    thread = thread_result.data or []

    symptoms = entry.get("extracted_symptoms") or []

    if req.resolve:
        # User explicitly requested resolution
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        recent = (
            sb.table("entries")
            .select("*")
            .eq("user_id", user_id)
            .neq("id", entry_id)
            .gte("created_at", thirty_days_ago)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        # Fetch user profile for demographics context
        profile_result = sb.table("user_profiles").select("*").eq("user_id", user_id).execute()
        user_profile = profile_result.data[0] if profile_result.data else None

        resolution = await resolve_entry(
            entry["raw_text"], symptoms, thread, recent.data or [], user_profile
        )

        # Build patient demographics for report
        patient_demographics = {}
        if user_profile:
            if user_profile.get("age"):
                patient_demographics["age"] = user_profile["age"]
            if user_profile.get("sex"):
                patient_demographics["sex"] = user_profile["sex"]
            if user_profile.get("conditions"):
                conds = user_profile["conditions"]
                if isinstance(conds, list) and conds:
                    patient_demographics["conditions"] = conds
            if user_profile.get("medications"):
                meds = user_profile["medications"]
                if isinstance(meds, list) and meds:
                    patient_demographics["medications"] = meds
            if user_profile.get("allergies"):
                allergies = user_profile["allergies"]
                if isinstance(allergies, list) and allergies:
                    patient_demographics["allergies"] = allergies

        # Build triage report JSONB
        triage_report = {
            "summary": resolution.get("summary", ""),
            "symptoms_identified": resolution.get("symptoms_identified", []),
            "assessment": resolution.get("assessment", ""),
            "recommended_action": resolution.get("recommended_action", ""),
            "watch_for": resolution.get("watch_for", []),
            "urgency_timeframe": resolution.get("urgency_timeframe", ""),
            "recommended_care_type": resolution.get("recommended_care_type", "walk-in"),
            "recommended_facility_types": resolution.get("recommended_facility_types", [resolution.get("recommended_care_type", "walk-in")]),
            "facility_search_terms": resolution.get("facility_search_terms", []),
            "facility_exclude_keywords": resolution.get("facility_exclude_keywords", []),
            "patient_demographics": patient_demographics,
        }

        sb.table("entries").update(
            {
                "ctas_level": resolution["ctas_level"],
                "ctas_label": resolution["ctas_label"],
                "assessment": resolution["assessment"],
                "recommended_action": resolution["recommended_action"],
                "status": resolution["status"],
                "triage_report": triage_report,
            }
        ).eq("id", entry_id).execute()

        agent_text = "Your preliminary triage assessment is ready."
        sb.table("thread_messages").insert(
            {"entry_id": entry_id, "role": "assistant", "text": agent_text}
        ).execute()

        updated = sb.table("entries").select("*").eq("id", entry_id).execute()
        msgs = (
            sb.table("thread_messages")
            .select("*")
            .eq("entry_id", entry_id)
            .order("created_at")
            .execute()
        )

        # Regenerate health summary in background
        asyncio.create_task(regenerate_summary(user_id))

        return {
            "entry": _transform_entry(updated.data[0], msgs.data or []),
            "agentResponse": agent_text,
            "isResolved": True,
            "ctasLevel": resolution["ctas_level"],
            "assessment": resolution["assessment"],
            "recommendedAction": resolution["recommended_action"],
        }
    else:
        # Non-resolve: just store the message, acknowledge it
        sb.table("thread_messages").insert(
            {"entry_id": entry_id, "role": "assistant", "text": "Got it — I've noted that. You can add more details or hit Resolve when you're ready for your assessment."}
        ).execute()

        updated = sb.table("entries").select("*").eq("id", entry_id).execute()
        msgs = (
            sb.table("thread_messages")
            .select("*")
            .eq("entry_id", entry_id)
            .order("created_at")
            .execute()
        )

        return {
            "entry": _transform_entry(updated.data[0], msgs.data or []),
            "agentResponse": "Got it — I've noted that.",
            "isResolved": False,
        }


@router.get("")
async def list_entries(user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()

    # Fetch all entries
    entries_result = (
        sb.table("entries")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    entries = entries_result.data or []

    result = []
    for entry in entries:
        msgs_result = (
            sb.table("thread_messages")
            .select("*")
            .eq("entry_id", entry["id"])
            .order("created_at")
            .execute()
        )
        result.append(_transform_entry(entry, msgs_result.data or []))

    return {"entries": result}


@router.get("/{entry_id}")
async def get_entry(entry_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()

    entry_result = sb.table("entries").select("*").eq("id", entry_id).eq("user_id", user_id).execute()
    if not entry_result.data:
        raise HTTPException(status_code=404, detail="Entry not found")

    msgs = (
        sb.table("thread_messages")
        .select("*")
        .eq("entry_id", entry_id)
        .order("created_at")
        .execute()
    )

    return {"entry": _transform_entry(entry_result.data[0], msgs.data or [])}


@router.delete("/{entry_id}")
async def delete_entry(entry_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()

    # Verify entry belongs to user
    entry_result = sb.table("entries").select("id").eq("id", entry_id).eq("user_id", user_id).execute()
    if not entry_result.data:
        raise HTTPException(status_code=404, detail="Entry not found")

    # thread_messages cascade-deletes via FK
    sb.table("entries").delete().eq("id", entry_id).execute()

    # Regenerate health summary in background
    asyncio.create_task(regenerate_summary(user_id))

    return {"deleted": True}
