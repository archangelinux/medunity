"""
ER Demand Analysis Agent — powered by Railtracks + Gemini.
Provides ward routing, prep checklists, cluster detection,
capacity projection, and diversion recommendations.
"""

import os
import json
from collections import Counter
from datetime import datetime

from pydantic import BaseModel
import railtracks as rt


# ── Pydantic models for Railtracks compatibility ──

class SignalInput(BaseModel):
    id: str = ""
    ctas_level: int = 4
    chief_complaint: str = ""
    symptoms: list[str] = []
    eta_minutes: int = 15

class FacilityLoadInput(BaseModel):
    facility_id: str = ""
    name: str = ""
    utilization: int = 0
    incoming: int = 0
    capacity: int = 30

# ── Deterministic tool functions (no LLM needed) ──

WARD_MAP = {
    # CTAS 1
    (1, "cardiac"): "Resus Bay — Cardiac",
    (1, "neuro"): "Resus Bay — Neuro",
    (1, "respiratory"): "Resus Bay — Respiratory",
    (1, "injury"): "Resus Bay — Trauma",
    (1, "general"): "Resus Bay",
    # CTAS 2
    (2, "cardiac"): "CCU / Monitored Beds",
    (2, "neuro"): "Acute Neuro Bay",
    (2, "respiratory"): "Acute Respiratory",
    (2, "mental"): "Psychiatric Emergency",
    (2, "injury"): "Trauma Bay",
    (2, "general"): "Acute Assessment",
    # CTAS 3
    (3, "respiratory"): "Respiratory Isolation",
    (3, "mental"): "Psychiatric Assessment",
    (3, "gi"): "Acute Medical",
    (3, "pain"): "Acute Medical",
    (3, "general"): "Acute Medical",
    # CTAS 4-5
    (4, None): "Minor Treatment Area",
    (5, None): "Minor Treatment / Walk-in",
}

SYMPTOM_CATEGORY_MAP = {
    "chest pain": "cardiac", "palpitations": "cardiac", "sweating": "cardiac",
    "dizziness": "neuro", "confusion": "neuro", "numbness": "neuro",
    "vision changes": "neuro", "weakness": "neuro",
    "cough": "respiratory", "shortness of breath": "respiratory",
    "wheezing": "respiratory", "chest tightness": "respiratory", "sore throat": "respiratory",
    "nausea": "gi", "vomiting": "gi", "diarrhea": "gi",
    "abdominal cramps": "gi", "loss of appetite": "gi", "abdominal pain": "gi",
    "headache": "pain", "back pain": "pain", "joint pain": "pain",
    "anxiety": "mental", "depression": "mental", "insomnia": "mental",
    "panic attacks": "mental", "stress": "mental",
    "laceration": "injury", "swelling": "injury", "bruising": "injury",
    "limited mobility": "injury", "bleeding": "injury",
    "fever": "general", "fatigue": "general", "chills": "general", "body aches": "general",
}

PREP_ITEMS = {
    "cardiac": ["12-lead ECG on arrival", "Crash cart standby", "Cardiac monitor", "IV access kit"],
    "neuro": ["Neuro assessment kit", "CT scanner on standby", "Stroke code page if needed"],
    "respiratory": ["Oxygen setup", "Nebulizer", "Pulse oximeter", "Isolation room if infectious"],
    "gi": ["IV fluids for rehydration", "Anti-emetics available", "Stool sample kit"],
    "pain": ["Pain assessment scale", "Analgesics available", "Imaging requisition"],
    "mental": ["Safe room assignment", "1:1 observation if needed", "Psychiatry consult page"],
    "injury": ["Wound care tray", "Splinting materials", "Tetanus status check", "X-ray requisition"],
    "general": ["Vitals monitoring", "Blood work requisition", "Isolation if febrile"],
}


def _detect_category(symptoms: list[str], chief_complaint: str) -> str:
    """Determine primary symptom category."""
    counts: Counter = Counter()
    for s in symptoms:
        cat = SYMPTOM_CATEGORY_MAP.get(s.lower())
        if cat:
            counts[cat] += 1
    # Also check chief complaint keywords
    cc_lower = chief_complaint.lower()
    for keyword, cat in SYMPTOM_CATEGORY_MAP.items():
        if keyword in cc_lower:
            counts[cat] += 1
    if counts:
        return counts.most_common(1)[0][0]
    return "general"


def suggest_ward(ctas_level: int, chief_complaint: str, symptoms: list[str]) -> dict:
    """Deterministic ward routing based on CTAS level and symptom category."""
    category = _detect_category(symptoms, chief_complaint)

    if ctas_level >= 4:
        ward = WARD_MAP.get((ctas_level, None), "Minor Treatment Area")
    else:
        ward = WARD_MAP.get((ctas_level, category), WARD_MAP.get((ctas_level, "general"), "Acute Assessment"))

    return {"ward": ward, "category": category, "ctas_level": ctas_level}


def generate_prep_checklist(ctas_level: int, symptoms: list[str], chief_complaint: str) -> dict:
    """Generate actionable prep checklist based on acuity and symptoms."""
    category = _detect_category(symptoms, chief_complaint)
    items = list(PREP_ITEMS.get(category, PREP_ITEMS["general"]))

    # Add universal high-acuity items
    if ctas_level <= 2:
        items = ["IMMEDIATE: Assign senior physician", "Resus team on standby"] + items
    if ctas_level == 1:
        items.insert(0, "CODE: Page trauma/resus team NOW")

    return {"checklist": items, "category": category}


def detect_clusters(signals: list[dict]) -> list[dict]:
    """Find 3+ same-category patients within a 1-hour window → cluster alert."""
    alerts = []
    if not signals:
        return alerts

    # Group by category
    categorized: dict[str, list] = {}
    for sig in signals:
        syms = sig.get("symptoms", [])
        if isinstance(syms, str):
            syms = [s.strip() for s in syms.split(",")]
        cat = _detect_category(syms, sig.get("chief_complaint", ""))
        categorized.setdefault(cat, []).append(sig)

    for cat, sigs in categorized.items():
        if len(sigs) >= 3:
            alerts.append({
                "category": cat,
                "count": len(sigs),
                "message": f"{len(sigs)} {cat} patients incoming",
                "protocol": CLUSTER_PROTOCOLS.get(cat, f"Monitor {cat} cluster trend"),
            })

    return alerts


def project_capacity(current_load: int, incoming_rate: float, capacity: int) -> dict:
    """Project minutes until facility hits capacity."""
    remaining = max(capacity - current_load, 0)
    if incoming_rate <= 0:
        return {
            "minutes_until_full": None,
            "current_utilization": round((current_load / max(capacity, 1)) * 100),
            "recommendation": "Stable — no incoming demand detected.",
        }

    minutes = remaining / incoming_rate * 60 if incoming_rate > 0 else None

    rec_parts = []
    util = round((current_load / max(capacity, 1)) * 100)
    if minutes and minutes < 60:
        rec_parts.append(f"Projected full in {int(minutes)} min.")
        rec_parts.append("Consider: expedite discharges, divert CTAS 4-5.")
    elif minutes and minutes < 120:
        rec_parts.append(f"Projected full in ~{int(minutes)} min.")
        rec_parts.append("Monitor closely. Prepare contingency.")
    else:
        rec_parts.append("Capacity outlook stable for next 2 hours.")

    return {
        "minutes_until_full": int(minutes) if minutes else None,
        "current_utilization": util,
        "recommendation": " ".join(rec_parts),
    }


CLUSTER_PROTOCOLS = {
    "respiratory": "Consider isolation protocol — possible outbreak",
    "cardiac": "Pre-alert cath lab — multiple cardiac presentations",
    "neuro": "Stroke code readiness — cluster of neuro presentations",
    "injury": "Mass casualty protocol consideration",
    "gi": "Infection control alert — GI cluster",
    "mental": "Crisis team activation — psychiatric surge",
}


def recommend_diversions(facility_load: dict, nearby_loads: list[dict]) -> list[dict]:
    """Suggest diverting low-acuity patients to less-loaded nearby facilities."""
    recommendations = []
    my_util = facility_load.get("utilization", 0)

    if my_util < 70:
        return recommendations  # No need to divert

    # Sort nearby by utilization ascending
    candidates = sorted(nearby_loads, key=lambda x: x.get("utilization", 100))

    for nb in candidates[:3]:
        if nb.get("utilization", 100) < my_util - 15:
            recommendations.append({
                "facility_name": nb.get("name", "Unknown"),
                "facility_id": nb.get("facility_id", ""),
                "current_utilization": nb.get("utilization", 0),
                "recommendation": f"Divert CTAS 4-5 to {nb.get('name', 'nearby facility')} ({nb.get('utilization', 0)}% capacity)",
            })

    return recommendations


# ── Railtracks-compatible typed wrappers ──
# Railtracks requires Pydantic models, not raw dicts.

def rt_suggest_ward(ctas_level: int, chief_complaint: str, symptoms: list[str]) -> dict:
    """Route patient to appropriate ward based on CTAS level and symptoms."""
    return suggest_ward(ctas_level, chief_complaint, symptoms)

def rt_generate_prep_checklist(ctas_level: int, symptoms: list[str], chief_complaint: str) -> dict:
    """Generate preparation checklist for incoming patient."""
    return generate_prep_checklist(ctas_level, symptoms, chief_complaint)

def rt_detect_clusters(signals: list[SignalInput]) -> list[dict]:
    """Detect clusters of similar patients that may need protocol activation."""
    return detect_clusters([s.model_dump() for s in signals])

def rt_project_capacity(current_load: int, incoming_rate: float, capacity: int) -> dict:
    """Project when facility will reach capacity and recommend actions."""
    return project_capacity(current_load, incoming_rate, capacity)

def rt_recommend_diversions(facility_load: FacilityLoadInput, nearby_loads: list[FacilityLoadInput]) -> list[dict]:
    """Recommend diverting low-acuity patients to less-loaded facilities."""
    return recommend_diversions(facility_load.model_dump(), [n.model_dump() for n in nearby_loads])


# ── Railtracks Agent Setup ──

_rt_suggest_ward_node = rt.function_node(rt_suggest_ward, name="suggest_ward")
_rt_prep_checklist_node = rt.function_node(rt_generate_prep_checklist, name="generate_prep_checklist")
_rt_detect_clusters_node = rt.function_node(rt_detect_clusters, name="detect_clusters")
_rt_project_capacity_node = rt.function_node(rt_project_capacity, name="project_capacity")
_rt_recommend_diversions_node = rt.function_node(rt_recommend_diversions, name="recommend_diversions")


def _build_demand_agent():
    """Build the Railtracks demand analysis flow."""
    gemini_api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    demand_agent = rt.agent_node(
        "ER Demand Analyst",
        tool_nodes=[
            _rt_suggest_ward_node,
            _rt_prep_checklist_node,
            _rt_detect_clusters_node,
            _rt_project_capacity_node,
            _rt_recommend_diversions_node,
        ],
        llm=rt.llm.GeminiLLM("gemini-2.5-flash", api_key=gemini_api_key),
        system_message=(
            "You are an ER Demand Analyst for a Canadian hospital. "
            "Analyze incoming patient signals and provide actionable insights. "
            "Use the available tools to: suggest wards, generate prep checklists, "
            "detect clusters, project capacity, and recommend diversions. "
            "Be concise and actionable. Focus on patient safety and resource optimization."
        ),
    )

    return rt.Flow(name="Demand Analysis", entry_point=demand_agent)


_demand_flow = None


def get_demand_flow():
    global _demand_flow
    if _demand_flow is None:
        _demand_flow = _build_demand_agent()
    return _demand_flow


async def run_demand_analysis(
    signals: list[dict],
    facility_name: str,
    facility_load: dict,
    nearby_loads: list[dict],
) -> dict:
    """Run the full demand analysis pipeline.

    Runs deterministic tools directly (fast path) and uses the Railtracks
    agent for the AI summary that ties everything together.
    """
    # ── Deterministic analysis (always runs) ──
    ward_suggestions = []
    all_checklists = []
    for sig in signals:
        syms = sig.get("symptoms", [])
        if isinstance(syms, str):
            syms = [s.strip() for s in syms.split(",")]
        cc = sig.get("chief_complaint", "")
        ctas = sig.get("ctas_level", 4)

        ward = suggest_ward(ctas, cc, syms)
        ward_suggestions.append({**ward, "signal_id": sig.get("id")})

        checklist = generate_prep_checklist(ctas, syms, cc)
        all_checklists.append({**checklist, "signal_id": sig.get("id")})

    cluster_alerts = detect_clusters(signals)

    incoming_rate = len(signals) / 2.0  # signals per hour (2-hour window)
    capacity_proj = project_capacity(
        facility_load.get("incoming", 0),
        incoming_rate,
        facility_load.get("capacity", 30),
    )

    diversions = recommend_diversions(facility_load, nearby_loads)

    # ── AI Summary via Railtracks agent ──
    summary = ""
    try:
        flow = get_demand_flow()
        prompt = (
            f"Analyze demand for {facility_name}. "
            f"There are {len(signals)} incoming patients. "
            f"Cluster alerts: {json.dumps(cluster_alerts)}. "
            f"Capacity projection: {json.dumps(capacity_proj)}. "
            f"Diversion recommendations: {json.dumps(diversions)}. "
            f"Provide a concise 2-3 sentence actionable summary for the charge nurse."
        )
        result = await flow.ainvoke(prompt)
        summary = str(result) if result else ""
    except Exception as e:
        print(f"[demand] Railtracks agent failed: {e}")
        # Fallback: generate summary from deterministic data
        parts = []
        parts.append(f"{len(signals)} patients incoming to {facility_name}.")
        if cluster_alerts:
            for alert in cluster_alerts:
                parts.append(f"ALERT: {alert['message']} — {alert['protocol']}.")
        if capacity_proj.get("minutes_until_full"):
            parts.append(capacity_proj["recommendation"])
        if diversions:
            parts.append(diversions[0]["recommendation"] + ".")
        summary = " ".join(parts) if parts else f"No significant demand patterns for {facility_name}."

    return {
        "summary": summary,
        "wardSuggestions": ward_suggestions,
        "clusterAlerts": cluster_alerts,
        "capacityProjection": capacity_proj,
        "diversionRecommendations": diversions,
        "prepChecklists": all_checklists,
    }
