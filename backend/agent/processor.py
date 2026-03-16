import json
from google import genai
from google.genai.types import GenerateContentConfig
from backend.agent.triage import assess_ctas

MODEL = "gemini-2.5-flash"


def _parse_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)
    return json.loads(cleaned)


async def process_new_entry(entry_text: str, recent_entries: list, profile: dict | None = None) -> dict:
    """Process a new health entry: extract symptoms, check for links, generate triage form questions."""
    client = genai.Client()

    # Patient profile context
    profile_context = ""
    if profile:
        parts = []
        if profile.get("age"):
            parts.append(f"{profile['age']} year old")
        if profile.get("sex"):
            parts.append(profile["sex"])
        if profile.get("conditions"):
            conds = profile["conditions"] if isinstance(profile["conditions"], list) else []
            if conds:
                parts.append(f"known conditions: {', '.join(conds)}")
        if profile.get("medications"):
            meds = profile["medications"] if isinstance(profile["medications"], list) else []
            if meds:
                parts.append(f"current medications: {', '.join(meds)}")
        if profile.get("allergies"):
            allergies = profile["allergies"] if isinstance(profile["allergies"], list) else []
            if allergies:
                parts.append(f"allergies: {', '.join(allergies)}")
        if parts:
            profile_context = f"\nPatient demographics: {', '.join(parts)}\n"

    recent_context = ""
    if recent_entries:
        recent_lines = []
        for e in recent_entries[:5]:
            symptoms = ", ".join(s["label"] for s in (e.get("extracted_symptoms") or []))
            recent_lines.append(
                f"- [{e['created_at'][:10]}] (id: {e['id']}) \"{e['raw_text']}\" → Symptoms: {symptoms or 'none extracted'}"
            )
        recent_context = "Recent health entries from this user:\n" + "\n".join(recent_lines)

    prompt = f"""You are a health triage agent for a Canadian health tracking app. A user has submitted a new health entry. Your job is to:

1. Extract specific symptoms from their text (each with a label and category)
2. Check if this relates to any of their recent entries (pattern detection)
3. Generate 4-6 structured triage questions as a FORM (not a conversation) to assess the situation
4. Estimate an initial CTAS level (Canadian Triage and Acuity Scale, 1-5)
{profile_context}
{recent_context}

New entry text: "{entry_text}"

Respond ONLY with valid JSON in this exact format:
{{
  "extracted_symptoms": [
    {{"label": "Symptom Name", "category": "pain|digestive|neurological|respiratory|mental|general"}}
  ],
  "linked_entry_id": null,
  "link_reason": null,
  "triage_questions": [
    {{"id": "q1", "question": "Rate your pain severity", "type": "scale"}},
    {{"id": "q2", "question": "Is the pain constant or does it come and go?", "type": "choice", "options": ["Constant", "Comes and goes", "Only with movement"]}},
    {{"id": "q3", "question": "Are you experiencing any of the following?", "type": "multiselect", "options": ["Nausea", "Dizziness", "Shortness of breath", "None of the above"]}},
    {{"id": "q4", "question": "Do you have a fever?", "type": "yesno"}},
    {{"id": "q5", "question": "Any other symptoms you want to mention?", "type": "text"}}
  ],
  "immediate_ctas_estimate": 4,
  "needs_followup": true
}}

Question types:
- "yesno": Simple yes/no toggle
- "scale": Pain/severity scale 1-10
- "choice": Single-select with "options" array (2-5 options) — use when only ONE answer makes sense (e.g., "Is the pain constant or intermittent?")
- "multiselect": Multi-select with "options" array (3-6 options, last should be "None of the above") — use when MULTIPLE answers can apply (e.g., "Which of these symptoms are you also experiencing?")
- "text": Free-text response

Rules:
- Generate 4-6 triage questions that cover severity, duration, associated symptoms, and red flags
- Questions should be clear and non-clinical — written for regular people
- CRITICAL: Do NOT ask questions the user already answered in their entry text. If they said "since yesterday", do not ask "how long have you had this?". If they said "pain is 7/10", do not ask them to rate severity. Read the entry carefully and only ask what is NOT already known.
- linked_entry_id: set to the exact UUID from recent entries if clearly related, null otherwise
- Categories must be one of: pain, digestive, neurological, respiratory, mental, general
- If CTAS 1-2 (emergent/resuscitation), set needs_followup to false and triage_questions to []
- End with a text question for anything else they want to share"""

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=GenerateContentConfig(temperature=0.2),
    )
    result = _parse_json(response.text)

    # Ensure required fields
    result.setdefault("extracted_symptoms", [])
    result.setdefault("linked_entry_id", None)
    result.setdefault("link_reason", None)
    result.setdefault("triage_questions", [])
    result.setdefault("immediate_ctas_estimate", 4)
    result.setdefault("needs_followup", True)

    return result


async def resolve_entry(
    entry_text: str,
    symptoms: list,
    thread_history: list,
    recent_entries: list,
    profile: dict | None = None,
) -> dict:
    """Resolve an entry with full CTAS assessment after gathering triage info."""

    # Patient demographics context
    demographics = ""
    if profile:
        parts = []
        if profile.get("age"):
            parts.append(f"{profile['age']} year old")
        if profile.get("sex"):
            parts.append(profile["sex"])
        if profile.get("conditions"):
            conds = profile["conditions"] if isinstance(profile["conditions"], list) else []
            if conds:
                parts.append(f"known conditions: {', '.join(conds)}")
        if profile.get("medications"):
            meds = profile["medications"] if isinstance(profile["medications"], list) else []
            if meds:
                parts.append(f"current medications: {', '.join(meds)}")
        if profile.get("allergies"):
            allergies = profile["allergies"] if isinstance(profile["allergies"], list) else []
            if allergies:
                parts.append(f"allergies: {', '.join(allergies)}")
        if parts:
            demographics = f"Patient: {', '.join(parts)}\n"

    # Build thread context (includes triage form answers)
    thread_context = ""
    if thread_history:
        thread_lines = []
        for msg in thread_history:
            role_label = "Agent" if msg["role"] == "assistant" else "User"
            thread_lines.append(f"{role_label}: {msg['text']}")
        thread_context = "Conversation/triage responses:\n" + "\n".join(thread_lines)

    symptom_list = ", ".join(s.get("label", str(s)) for s in symptoms) if symptoms else "none extracted"

    # Build structured presentation for triage
    presentation = f"""{demographics}Original complaint: "{entry_text}"
Extracted symptoms: {symptom_list}
{thread_context}"""

    # Get CTAS assessment from triage module
    triage_result = await assess_ctas(presentation)

    # Generate full assessment with Gemini
    client = genai.Client()

    prompt = f"""You are a health assessment agent for a Canadian health tracking app. Based on the user's complaint and triage responses, provide a structured triage report.

{presentation}

CTAS Assessment: Level {triage_result['ctas_level']} - {triage_result['ctas_label']}
Triage reasoning: {triage_result['reasoning']}

IMPORTANT — You MUST use the CTAS level above. Do NOT override it. The CTAS assessment was produced by a fine-tuned clinical model and is authoritative. Your job is to generate the report content around that level, not to re-triage.

CTAS calibration reference:
- CTAS 1 (Resuscitation): cardiac arrest, major trauma, respiratory failure, unconscious
- CTAS 2 (Emergent): chest pain with cardiac features, stroke signs, severe allergic reaction, active hemorrhage
- CTAS 3 (Urgent): high fever >39°C, asthma attack, persistent vomiting, significant pain 7+/10
- CTAS 4 (Less Urgent): mild-moderate pain, earache, sore throat with fever, UTI symptoms, headache without red flags
- CTAS 5 (Non-Urgent): mild cold, prescription refill, minor scratch, chronic stable complaint

A "dull headache with nausea" without red flags (no neck stiffness, no fever >39°C, no vision loss, no worst-headache-of-life) is CTAS 4-5, NOT CTAS 2. Do not over-triage.

Respond ONLY with valid JSON:
{{
  "ctas_level": {triage_result['ctas_level']},
  "ctas_label": "{triage_result['ctas_label']}",
  "summary": "A concise 1-sentence summary of the patient's presentation.",
  "symptoms_identified": ["symptom1", "symptom2"],
  "assessment": "A 2-3 sentence clinical assessment for the user. Be clear and empathetic. If the user asked a question or expressed a concern (e.g., 'wondering if I should take anything', 'should I go to the ER?'), address it directly here.",
  "recommended_action": "Specific next step recommendation. If the user asked about medication or treatment, include practical advice (e.g., 'Acetaminophen or ibuprofen for symptom relief', 'Warm fluids and rest'). Be actionable.",
  "watch_for": ["Red-flag symptom 1", "Red-flag symptom 2", "Red-flag symptom 3"],
  "urgency_timeframe": "e.g., 'Within 24 hours', 'Within 1 week', 'Self-monitor'",
  "recommended_care_type": "hospital|walk-in|urgent-care|telehealth",
  "recommended_facility_types": ["walk-in", "hospital"],
  "facility_search_terms": ["lab work", "blood work", "urology"],
  "facility_exclude_keywords": ["pediatric", "children", "mental health", "cancer", "addiction"],
  "status": "resolved"
}}

Rules:
- summary should be a single clear sentence describing what's going on
- symptoms_identified should be an array of specific symptom strings extracted from the presentation
- assessment should be informative but not alarming
- recommended_action should be specific and actionable
- watch_for must be an array of 2-5 specific red-flag symptoms to monitor
- urgency_timeframe must indicate when care should be sought
- recommended_care_type must be one of: hospital, walk-in, urgent-care, telehealth
- recommended_facility_types: array of facility types relevant for THIS specific condition. Choose from: hospital, walk-in, urgent-care, community-centre, wellness-centre, telehealth. Only include types that would actually treat this condition (e.g., do NOT include community-centre or wellness-centre for physical injuries/infections; do NOT include hospital for minor colds)
- facility_search_terms: 2-4 keywords describing services the patient needs (e.g., "urology", "X-ray", "blood work", "mental health"). These are used to match facilities by their listed services
- facility_exclude_keywords: keywords that should EXCLUDE a facility from results. Think about what specialties are NOT relevant. For example, if the patient has a UTI, exclude "pediatric", "children", "mental health", "addiction", "cancer", "maternity". If the patient has depression, exclude "pediatric", "cancer", "orthopedic". Always exclude "pediatric" and "children" for adult patients. This is critical for filtering out irrelevant results like showing a cancer centre for a headache."""

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=GenerateContentConfig(temperature=0.2),
    )
    result = _parse_json(response.text)

    # Ensure required fields with triage fallbacks
    result.setdefault("ctas_level", triage_result["ctas_level"])
    result.setdefault("ctas_label", triage_result["ctas_label"])
    result.setdefault("summary", "Assessment completed.")
    result.setdefault("symptoms_identified", [])
    result.setdefault("assessment", "Assessment completed.")
    result.setdefault("recommended_action", "Monitor symptoms.")
    result.setdefault("watch_for", [])
    result.setdefault("urgency_timeframe", "Monitor as needed")
    result.setdefault("recommended_care_type", "walk-in")
    result.setdefault("recommended_facility_types", [result.get("recommended_care_type", "walk-in")])
    result.setdefault("facility_search_terms", [])
    result.setdefault("facility_exclude_keywords", [])
    result.setdefault("status", "resolved")

    # Normalize watch_for to array if string
    if isinstance(result["watch_for"], str):
        result["watch_for"] = [s.strip() for s in result["watch_for"].split(",") if s.strip()] if result["watch_for"] else []

    return result
