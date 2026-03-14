from collections import Counter
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends

from backend.services.supabase import get_supabase
from backend.api.deps import get_current_user_id

router = APIRouter(prefix="/api/overview", tags=["overview"])

# Assign colors to symptoms deterministically
SYMPTOM_COLORS = [
    "#1D4ED8",  # blue
    "#94A3B8",  # slate
    "#D97706",  # amber
    "#DC2626",  # red
    "#0891B2",  # cyan
    "#7C3AED",  # purple
    "#059669",  # emerald
    "#EA580C",  # orange
]


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

    # Pattern detection: symptoms appearing 3+ times
    pattern_alert = None
    frequent = [(s, c) for s, c in symptom_counter.items() if c >= 3]
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

        pattern_alert = {
            "id": "pattern-auto",
            "title": f"Recurring {top_symptom.lower()} pattern",
            "description": f"{top_count} {top_symptom.lower()} entries in the past 30 days. Consider consulting a healthcare provider for ongoing management.",
            "ctasTrend": trend,
            "relatedEntries": top_count,
        }

    # Health status summary
    summary = ""
    if entry_count > 0:
        if frequent:
            summary = f"Recurring {frequent[0][0].lower()} pattern detected over the past 30 days."
        else:
            summary = f"{entry_count} health entries recorded in the past 30 days."

    return {
        "entryCount": entry_count,
        "avgCtas": avg_ctas,
        "summary": summary,
        "symptomFrequency": symptom_frequency,
        "patternAlert": pattern_alert,
    }
