from collections import Counter
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from google import genai

from backend.services.supabase import get_supabase
from backend.api.deps import get_current_user_id

router = APIRouter(prefix="/api/overview", tags=["overview"])

MODEL = "gemini-2.5-flash"

# Assign colors to symptoms deterministically — soft palette
SYMPTOM_COLORS = [
    "#2364AA",  # ocean deep
    "#E5625E",  # lobster pink
    "#CD533B",  # rosy copper
    "#62A8AC",  # tropical teal
    "#8BA868",  # tea green
    "#5D9E82",  # sage
    "#1A4B80",  # deep blue
    "#3D7A7E",  # dark teal
]


async def _generate_ai_summary(entries: list, profile: dict | None = None) -> str:
    """Generate a concise AI summary of the patient's recent health entries."""
    if not entries:
        return ""

    # Build context from entries
    lines = []
    for e in entries[:10]:  # max 10 most recent
        created = e.get("created_at", "")
        date = created[:10]
        time = created[11:16] if len(created) > 16 else ""
        timestamp = f"{date} {time}".strip()
        text = e.get("raw_text", "")
        symptoms = e.get("extracted_symptoms") or []
        symptom_labels = ", ".join(
            s.get("label", str(s)) if isinstance(s, dict) else str(s)
            for s in symptoms
        )
        ctas = e.get("ctas_level")
        status = e.get("status", "active")
        assessment = e.get("assessment", "")
        linked = e.get("linked_entry_id")

        entry_line = f"- [{timestamp}] \"{text}\""
        if symptom_labels:
            entry_line += f" → Symptoms: {symptom_labels}"
        if ctas:
            entry_line += f" (CTAS {ctas})"
        if status == "resolved" and assessment:
            entry_line += f" — {assessment[:100]}"
        if linked:
            entry_line += f" [LINKED to prior entry]"
        lines.append(entry_line)

    entries_text = "\n".join(lines)

    # Add profile context if available
    profile_context = ""
    if profile:
        parts = []
        if profile.get("age"):
            parts.append(f"{profile['age']} year old")
        if profile.get("sex"):
            parts.append(profile["sex"])
        if profile.get("conditions"):
            parts.append(f"conditions: {', '.join(profile['conditions'])}")
        if profile.get("medications"):
            parts.append(f"medications: {', '.join(profile['medications'])}")
        if parts:
            profile_context = f"\nPatient context: {', '.join(parts)}\n"

    prompt = f"""You are a health status advisor.{profile_context} Given a patient's recent health entries, write a brief health status commentary (2-3 sentences).

Entries (most recent first):
{entries_text}

Pay close attention to:
- SAME-DAY ESCALATION: If multiple entries on the same day show the same symptom worsening (e.g., headache going from "dull" to "severe" to "with vomiting"), that is a significant trend — flag it clearly
- LINKED ENTRIES: Entries marked [LINKED] are the AI's detected connections — these confirm a pattern
- RECURRING SYMPTOMS: Same symptom appearing across multiple days
- NEW SYMPTOMS: Symptoms appearing for the first time alongside existing ones

This is NOT a summary of each entry. It is a clinical trajectory assessment — is this person getting worse today, stable over the week, or improving?

Rules:
- 2-3 sentences max, plain language
- If symptoms are escalating within the same day, say so directly (e.g., "Your headache has worsened through the day with new symptoms appearing — this progression warrants attention")
- If things look stable/mild, reassure them
- Do NOT list individual entries or repeat what they said
- Do NOT use markdown, bullet points, or formatting
- Do NOT start with "Based on" or "Overall" — just state the commentary directly"""

    try:
        client = genai.Client()
        response = await client.aio.models.generate_content(
            model=MODEL,
            contents=prompt,
        )
        summary = response.text.strip()
        # Remove any markdown formatting the model might add
        summary = summary.replace("**", "").replace("*", "")
        return summary
    except Exception:
        return ""


@router.get("")
async def get_overview(user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()

    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    entries_result = (
        sb.table("entries")
        .select("*")
        .eq("user_id", user_id)
        .gte("created_at", thirty_days_ago)
        .order("created_at", desc=True)
        .execute()
    )
    entries = entries_result.data or []

    # Compute stats
    entry_count = len(entries)
    ctas_levels = [e["ctas_level"] for e in entries if e.get("ctas_level")]
    avg_ctas = round(sum(ctas_levels) / len(ctas_levels), 1) if ctas_levels else 0

    # Symptom frequency
    symptom_counter: Counter[str] = Counter()
    for e in entries:
        symptoms = e.get("extracted_symptoms") or []
        for s in symptoms:
            label = s.get("label", str(s)) if isinstance(s, dict) else str(s)
            symptom_counter[label] += 1

    symptom_frequency = [
        {
            "symptom": symptom,
            "count": count,
            "color": SYMPTOM_COLORS[i % len(SYMPTOM_COLORS)],
        }
        for i, (symptom, count) in enumerate(symptom_counter.most_common(8))
    ]

    # Pattern detection: symptoms appearing 2+ times (catches same-day escalation)
    pattern_alert = None
    frequent = [(s, c) for s, c in symptom_counter.items() if c >= 2]
    if frequent:
        top_symptom, top_count = frequent[0]
        # Determine trend based on whether the most recent entry has this symptom
        trend = "stable"
        if entries:
            recent_symptoms = [
                s.get("label", "") if isinstance(s, dict) else str(s)
                for s in (entries[0].get("extracted_symptoms") or [])
            ]
            if top_symptom in recent_symptoms:
                trend = "worsening"

        # Collect the actual entry IDs that contain this symptom
        related_entry_ids = []
        for e in entries:
            entry_symptoms = [
                s.get("label", "") if isinstance(s, dict) else str(s)
                for s in (e.get("extracted_symptoms") or [])
            ]
            if top_symptom in entry_symptoms:
                related_entry_ids.append(e["id"])

        pattern_alert = {
            "id": "pattern-auto",
            "title": f"Recurring {top_symptom.lower()} pattern",
            "description": f"{top_count} {top_symptom.lower()} entries in the past 30 days. Consider consulting a healthcare provider for ongoing management.",
            "ctasTrend": trend,
            "relatedEntries": top_count,
            "relatedEntryIds": related_entry_ids,
        }

    # Serve cached summary from user_profiles, or generate inline if missing
    summary = ""
    profile = None
    try:
        profile_result = sb.table("user_profiles").select("*").eq("user_id", user_id).execute()
        if profile_result.data:
            profile = profile_result.data[0]
            summary = profile.get("health_summary") or ""
    except Exception:
        pass  # Table may not exist yet

    # If no cached summary but we have entries, generate one now
    if not summary and entries:
        try:
            import asyncio
            summary = await asyncio.wait_for(
                _generate_ai_summary(entries, profile),
                timeout=15.0,
            )
            # Cache it
            if summary:
                try:
                    sb.table("user_profiles").upsert(
                        {
                            "user_id": user_id,
                            "health_summary": summary,
                            "summary_updated_at": datetime.now(timezone.utc).isoformat(),
                        },
                        on_conflict="user_id",
                    ).execute()
                except Exception:
                    pass
        except Exception:
            summary = ""

    return {
        "entryCount": entry_count,
        "avgCtas": avg_ctas,
        "summary": summary,
        "symptomFrequency": symptom_frequency,
        "patternAlert": pattern_alert,
    }


async def regenerate_summary(user_id: str):
    """Regenerate and cache the AI health summary. Called after entry changes."""
    sb = get_supabase()

    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    entries_result = (
        sb.table("entries")
        .select("*")
        .eq("user_id", user_id)
        .gte("created_at", thirty_days_ago)
        .order("created_at", desc=True)
        .execute()
    )
    entries = entries_result.data or []

    if not entries:
        return

    # Get profile context for better summary
    profile_result = sb.table("user_profiles").select("*").eq("user_id", user_id).execute()
    profile = profile_result.data[0] if profile_result.data else None

    summary = await _generate_ai_summary(entries, profile)

    if summary:
        sb.table("user_profiles").upsert(
            {
                "user_id": user_id,
                "health_summary": summary,
                "summary_updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="user_id",
        ).execute()
