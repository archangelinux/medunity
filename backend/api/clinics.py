import math
from fastapi import APIRouter, Query

from backend.services.supabase import get_supabase

router = APIRouter(prefix="/api/clinics", tags=["clinics"])

# CTAS level → allowed clinic types
CTAS_CARE_MAP = {
    1: ["er"],
    2: ["er"],
    3: ["er", "urgent_care", "after_hours"],
    4: ["walk_in", "after_hours", "telehealth"],
    5: ["walk_in", "telehealth"],
}

# Map DB type to frontend CareType
TYPE_MAP = {
    "er": "er",
    "walk_in": "walk-in",
    "urgent_care": "urgent-care",
    "after_hours": "walk-in",  # Map to closest frontend type
    "telehealth": "telehealth",
}


def _ensure_list(val: object) -> list:
    """Ensure a JSONB value is a Python list (Supabase may return a string)."""
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
    """Calculate distance in km between two lat/lng points."""
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


@router.get("/route")
async def route_care(
    ctas_level: int = Query(..., ge=1, le=5),
    latitude: float | None = Query(None),
    longitude: float | None = Query(None),
):
    sb = get_supabase()

    allowed_types = CTAS_CARE_MAP.get(ctas_level, ["walk_in", "telehealth"])

    # Fetch clinics matching allowed types
    clinics_result = (
        sb.table("clinics")
        .select("*")
        .in_("type", allowed_types)
        .order("wait_minutes")
        .execute()
    )
    clinics = clinics_result.data or []

    # Transform to frontend format
    result = []
    for i, c in enumerate(clinics[:5]):
        distance = 0.0
        if latitude and longitude and c.get("latitude") and c.get("longitude"):
            distance = round(_haversine(latitude, longitude, c["latitude"], c["longitude"]), 1)

        result.append(
            {
                "id": c["id"],
                "name": c["name"],
                "type": TYPE_MAP.get(c["type"], "walk-in"),
                "waitMinutes": c["wait_minutes"],
                "distanceKm": distance,
                "address": c["address"],
                "hours": c["hours"],
                "isOpen": c.get("is_open", True),
                "closingTime": c.get("closing_time"),
                "services": _ensure_list(c.get("services")),
                "recommended": i == 0,  # First (shortest wait) is recommended
            }
        )

    return {"clinics": result}
