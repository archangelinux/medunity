import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from backend.services.supabase import get_supabase

router = APIRouter(prefix="/api/locations", tags=["locations"])


# --- Models ---

class SubmitReportRequest(BaseModel):
    facility_id: str
    reporter_type: str  # 'visitor' | 'medical-professional'
    message: str
    wait_time_update: Optional[int] = None
    strain_level: Optional[str] = None  # 'low' | 'moderate' | 'high' | 'critical'


# --- Helpers ---

def _ensure_list(val: object) -> list:
    if isinstance(val, list):
        return val
    if isinstance(val, str):
        try:
            import json
            parsed = json.loads(val)
            return parsed if isinstance(parsed, list) else []
        except (json.JSONDecodeError, TypeError):
            return []
    return []


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


TYPE_MAP = {
    "er": "hospital",
    "walk_in": "walk-in",
    "urgent_care": "urgent-care",
    "after_hours": "walk-in",
    "telehealth": "telehealth",
    "community_centre": "community-centre",
    "wellness_centre": "wellness-centre",
}


# --- Endpoints ---

@router.get("/facilities")
async def get_facilities(
    facility_type: Optional[str] = Query(None),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
):
    """Get all facilities, optionally filtered by type, with distance calculation."""
    sb = get_supabase()

    query = sb.table("clinics").select("*").order("wait_minutes", desc=False)
    if facility_type:
        # Map frontend type back to DB types
        db_types = [k for k, v in TYPE_MAP.items() if v == facility_type]
        if db_types:
            query = query.in_("type", db_types)

    result = query.execute()
    clinics = result.data or []

    # Also fetch community centres if they exist
    try:
        cc_result = sb.table("community_centres").select("*").execute()
        centres = cc_result.data or []
    except Exception:
        centres = []

    # Fetch reports
    try:
        reports_result = sb.table("location_reports").select("*").order("created_at", desc=True).execute()
        all_reports = reports_result.data or []
    except Exception:
        all_reports = []

    # Fetch resources
    try:
        resources_result = sb.table("centre_resources").select("*").execute()
        all_resources = resources_result.data or []
    except Exception:
        all_resources = []

    # Build facility list from clinics
    facilities = []
    for c in clinics:
        fid = c["id"]
        distance = 0.0
        travel_min = 0
        if latitude and longitude and c.get("latitude") and c.get("longitude"):
            distance = round(_haversine(latitude, longitude, c["latitude"], c["longitude"]), 1)
            travel_min = round((distance / 40) * 60)

        reports = [
            {
                "id": r["id"],
                "facilityId": r["facility_id"],
                "reporterType": r["reporter_type"],
                "message": r["message"],
                "waitTimeUpdate": r.get("wait_time_update"),
                "strainLevel": r.get("strain_level"),
                "createdAt": r["created_at"],
            }
            for r in all_reports
            if r["facility_id"] == fid
        ]

        facilities.append(
            {
                "id": fid,
                "name": c["name"],
                "type": TYPE_MAP.get(c["type"], "walk-in"),
                "latitude": c.get("latitude"),
                "longitude": c.get("longitude"),
                "address": c["address"],
                "hours": c["hours"],
                "isOpen": c.get("is_open", True),
                "closingTime": c.get("closing_time"),
                "waitMinutes": c.get("wait_minutes"),
                "travelMinutes": travel_min if travel_min > 0 else None,
                "distanceKm": distance if distance > 0 else None,
                "services": _ensure_list(c.get("services")),
                "resources": [],
                "reports": reports,
                "isFree": True,
            }
        )

    # Add community centres
    for cc in centres:
        ccid = cc["id"]
        distance = 0.0
        travel_min = 0
        if latitude and longitude and cc.get("latitude") and cc.get("longitude"):
            distance = round(_haversine(latitude, longitude, cc["latitude"], cc["longitude"]), 1)
            travel_min = round((distance / 40) * 60)

        reports = [
            {
                "id": r["id"],
                "facilityId": r["facility_id"],
                "reporterType": r["reporter_type"],
                "message": r["message"],
                "waitTimeUpdate": r.get("wait_time_update"),
                "strainLevel": r.get("strain_level"),
                "createdAt": r["created_at"],
            }
            for r in all_reports
            if r["facility_id"] == ccid
        ]

        resources = [
            {
                "id": r["id"],
                "name": r["name"],
                "category": r["category"],
                "inStock": r.get("in_stock", True),
                "donationNeeded": r.get("donation_needed", False),
            }
            for r in all_resources
            if r["centre_id"] == ccid
        ]

        facilities.append(
            {
                "id": ccid,
                "name": cc["name"],
                "type": cc.get("type", "community-centre"),
                "latitude": cc.get("latitude"),
                "longitude": cc.get("longitude"),
                "address": cc["address"],
                "hours": cc["hours"],
                "isOpen": cc.get("is_open", True),
                "closingTime": cc.get("closing_time"),
                "waitMinutes": None,
                "travelMinutes": travel_min if travel_min > 0 else None,
                "distanceKm": distance if distance > 0 else None,
                "services": _ensure_list(cc.get("services")),
                "resources": resources,
                "reports": reports,
                "isFree": cc.get("is_free", True),
                "phone": cc.get("phone"),
            }
        )

    return {"facilities": facilities}


@router.post("/reports")
async def submit_report(req: SubmitReportRequest):
    """Submit an anonymous report for a facility."""
    sb = get_supabase()

    report_data = {
        "facility_id": req.facility_id,
        "reporter_type": req.reporter_type,
        "message": req.message,
        "wait_time_update": req.wait_time_update,
        "strain_level": req.strain_level,
    }

    result = sb.table("location_reports").insert(report_data).execute()
    report = result.data[0] if result.data else report_data

    # If wait time update provided, update the clinic's wait_minutes
    if req.wait_time_update:
        try:
            sb.table("clinics").update({"wait_minutes": req.wait_time_update}).eq(
                "id", req.facility_id
            ).execute()
        except Exception:
            pass  # May not be a clinic (could be community centre)

    return {
        "report": {
            "id": report.get("id", ""),
            "facilityId": report.get("facility_id", req.facility_id),
            "reporterType": report.get("reporter_type", req.reporter_type),
            "message": report.get("message", req.message),
            "waitTimeUpdate": report.get("wait_time_update"),
            "strainLevel": report.get("strain_level"),
            "createdAt": report.get("created_at", datetime.now(timezone.utc).isoformat()),
        }
    }
