"""Provider API — send reports, get signals, run demand analysis."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.supabase import get_supabase
from backend.agent.demand import suggest_ward, generate_prep_checklist, run_demand_analysis

router = APIRouter(prefix="/api/provider", tags=["provider"])


# ── Request/Response models ──

class SendReportRequest(BaseModel):
    entry_id: str | None = None
    facility_id: str
    facility_name: str
    ctas_level: int
    chief_complaint: str
    symptoms: list[dict] = []  # [{label, category}]
    eta_minutes: int = 15
    latitude: float
    longitude: float
    report_data: dict | None = None  # full triage document for provider viewing


class AnalyzeRequest(BaseModel):
    signals: list[dict]
    facility_name: str
    facility_load: dict
    nearby_loads: list[dict] = []


# ── Endpoints ──

@router.post("/send-report")
async def send_report(req: SendReportRequest):
    """Patient sends triage report to a facility — creates a provider signal."""
    sb = get_supabase()

    # Extract symptom labels for ward routing
    symptom_labels = [s["label"] if isinstance(s, dict) else s for s in req.symptoms]

    # Compute ward + checklist
    ward_result = suggest_ward(req.ctas_level, req.chief_complaint, symptom_labels)
    checklist_result = generate_prep_checklist(req.ctas_level, symptom_labels, req.chief_complaint)

    signal_data = {
        "entry_id": req.entry_id,
        "facility_id": req.facility_id,
        "facility_name": req.facility_name,
        "ctas_level": req.ctas_level,
        "chief_complaint": req.chief_complaint,
        "symptoms": symptom_labels,
        "eta_minutes": req.eta_minutes,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "suggested_ward": ward_result["ward"],
        "prep_checklist": checklist_result["checklist"],
        "report_data": req.report_data,
        "status": "active",
    }

    result = sb.table("provider_signals").insert(signal_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create signal")

    return {"signal": result.data[0], "ward": ward_result, "checklist": checklist_result}


@router.get("/{facility_id}/signals")
async def get_signals(facility_id: str):
    """Get active signals for a facility. Matches by facility_id OR by facility name similarity."""
    sb = get_supabase()

    # Get signals explicitly sent to this facility ID
    result = (
        sb.table("provider_signals")
        .select("*")
        .eq("status", "active")
        .order("reported_at", desc=True)
        .limit(100)
        .execute()
    )

    signals = result.data or []

    # Transform to frontend format
    formatted = []
    for sig in signals:
        formatted.append({
            "id": sig["id"],
            "entryId": sig.get("entry_id"),
            "facilityId": sig["facility_id"],
            "facilityName": sig["facility_name"],
            "ctasLevel": sig["ctas_level"],
            "chiefComplaint": sig["chief_complaint"],
            "symptoms": sig.get("symptoms") or [],
            "etaMinutes": sig["eta_minutes"],
            "latitude": sig["latitude"],
            "longitude": sig["longitude"],
            "suggestedWard": sig.get("suggested_ward"),
            "prepChecklist": sig.get("prep_checklist") or [],
            "status": sig["status"],
            "reportedAt": sig.get("reported_at"),
            "reportData": sig.get("report_data"),
            "isSimulated": False,
        })

    return {"signals": formatted}


@router.get("/entry/{entry_id}/signals")
async def get_signals_for_entry(entry_id: str):
    """Get all signals sent for a specific patient entry."""
    sb = get_supabase()
    result = (
        sb.table("provider_signals")
        .select("id, facility_id, facility_name, status")
        .eq("entry_id", entry_id)
        .execute()
    )
    signals = result.data or []
    return {
        "signals": [
            {
                "id": s["id"],
                "facilityId": s["facility_id"],
                "facilityName": s["facility_name"],
                "status": s["status"],
            }
            for s in signals
        ]
    }


@router.patch("/signal/{signal_id}/cancel")
async def cancel_signal(signal_id: str):
    """Cancel a previously sent signal."""
    sb = get_supabase()
    sb.table("provider_signals").update({"status": "cancelled"}).eq("id", signal_id).execute()
    return {"cancelled": True}


@router.patch("/signal/{signal_id}/arrived")
async def mark_arrived(signal_id: str):
    """Mark a signal as arrived."""
    sb = get_supabase()
    sb.table("provider_signals").update({"status": "arrived"}).eq("id", signal_id).execute()
    return {"arrived": True}


@router.delete("/signals/clear-all")
async def clear_all_signals():
    """Clear all active provider signals. Used for cleanup."""
    sb = get_supabase()
    sb.table("provider_signals").delete().eq("status", "active").execute()
    return {"cleared": True}


@router.post("/analyze")
async def analyze_demand(req: AnalyzeRequest):
    """Run Railtracks demand analysis agent."""
    try:
        result = await run_demand_analysis(
            signals=req.signals,
            facility_name=req.facility_name,
            facility_load=req.facility_load,
            nearby_loads=req.nearby_loads,
        )
        return {"analysis": result}
    except Exception as e:
        print(f"[provider] Demand analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
