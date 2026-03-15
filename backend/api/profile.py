from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, UploadFile, File
from pydantic import BaseModel
from google import genai
import json

from backend.services.supabase import get_supabase
from backend.api.deps import get_current_user_id

router = APIRouter(prefix="/api/profile", tags=["profile"])

MODEL = "gemini-2.5-flash"


class ProfileUpdate(BaseModel):
    age: int | None = None
    sex: str | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    conditions: list[str] = []
    medications: list[str] = []
    allergies: list[str] = []


def _transform_profile(row: dict) -> dict:
    return {
        "age": row.get("age"),
        "sex": row.get("sex"),
        "heightCm": row.get("height_cm"),
        "weightKg": row.get("weight_kg"),
        "conditions": row.get("conditions") or [],
        "medications": row.get("medications") or [],
        "allergies": row.get("allergies") or [],
        "labResults": row.get("lab_results") or [],
        "healthSummary": row.get("health_summary") or "",
        "summaryUpdatedAt": row.get("summary_updated_at"),
    }


@router.get("")
async def get_profile(user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    result = sb.table("user_profiles").select("*").eq("user_id", user_id).execute()

    if not result.data:
        return {"profile": _transform_profile({})}

    return {"profile": _transform_profile(result.data[0])}


@router.put("")
async def update_profile(req: ProfileUpdate, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()

    data = {
        "user_id": user_id,
        "age": req.age,
        "sex": req.sex,
        "height_cm": req.height_cm,
        "weight_kg": req.weight_kg,
        "conditions": req.conditions,
        "medications": req.medications,
        "allergies": req.allergies,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Upsert
    result = sb.table("user_profiles").upsert(data, on_conflict="user_id").execute()

    return {"profile": _transform_profile(result.data[0])}


@router.post("/lab-upload")
async def upload_lab_results(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """Upload a lab results PDF — Gemini extracts structured values."""
    contents = await file.read()

    # Use Gemini to extract lab values from the PDF
    client = genai.Client()

    prompt = """Extract all lab test results from this document into a JSON array. Each result should have:
- "test": the test name (e.g., "Hemoglobin", "Glucose", "TSH")
- "value": the numeric value as a string (e.g., "135", "5.2")
- "unit": the unit (e.g., "g/L", "mmol/L", "mIU/L")
- "range": the reference range if shown (e.g., "120-160")
- "flag": "normal", "high", or "low" based on the reference range
- "date": the collection date if visible (YYYY-MM-DD format)

Respond ONLY with a valid JSON array. If no lab results are found, respond with []."""

    try:
        response = await client.aio.models.generate_content(
            model=MODEL,
            contents=[
                {"mime_type": file.content_type or "application/pdf", "data": contents},
                prompt,
            ],
        )

        text = response.text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)

        lab_results = json.loads(text)
    except Exception:
        lab_results = []

    if lab_results:
        sb = get_supabase()
        # Get existing results and append
        existing = sb.table("user_profiles").select("lab_results").eq("user_id", user_id).execute()

        if existing.data:
            current = existing.data[0].get("lab_results") or []
            combined = current + lab_results
        else:
            combined = lab_results

        sb.table("user_profiles").upsert(
            {
                "user_id": user_id,
                "lab_results": combined,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="user_id",
        ).execute()

    return {"labResults": lab_results, "count": len(lab_results)}
