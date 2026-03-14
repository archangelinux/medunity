import json
from google import genai
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


async def process_new_entry(entry_text: str, recent_entries: list) -> dict:
    """Process a new health entry: extract symptoms, check for links, generate triage form questions."""
    client = genai.Client()

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
    {{"id": "q3", "question": "Do you have a fever?", "type": "yesno"}},
    {{"id": "q4", "question": "Any other symptoms you want to mention?", "type": "text"}}
  ],
  "immediate_ctas_estimate": 4,
  "needs_followup": true
}}

Question types:
- "yesno": Simple yes/no toggle
- "scale": Pain/severity scale 1-10
- "choice": Multiple choice with "options" array (2-5 options)
- "text": Free-text response

Rules:
- Generate 4-6 triage questions that cover severity, duration, associated symptoms, and red flags
- Questions should be clear and non-clinical — written for regular people
- linked_entry_id: set to the exact UUID from recent entries if clearly related, null otherwise
- Categories must be one of: pain, digestive, neurological, respiratory, mental, general
- If CTAS 1-2 (emergent/resuscitation), set needs_followup to false and triage_questions to []
- Always include at least one question about severity and one about duration
- End with a text question for anything else they want to share"""

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=prompt,
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
) -> dict:
    """Resolve an entry with full CTAS assessment after gathering triage info."""

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
    presentation = f"""Original complaint: "{entry_text}"
Extracted symptoms: {symptom_list}
{thread_context}"""

    # Get CTAS assessment from triage module
    triage_result = await assess_ctas(presentation)

    # Generate full assessment with Gemini
    client = genai.Client()

    prompt = f"""You are a health assessment agent for a Canadian health tracking app. Based on the user's complaint and triage responses, provide a clinical assessment.

{presentation}

CTAS Assessment: Level {triage_result['ctas_level']} - {triage_result['ctas_label']}
Triage reasoning: {triage_result['reasoning']}

Respond ONLY with valid JSON:
{{
  "ctas_level": {triage_result['ctas_level']},
  "ctas_label": "{triage_result['ctas_label']}",
  "assessment": "A 2-3 sentence clinical summary for the user. Be clear and empathetic.",
  "recommended_action": "Specific next step recommendation (e.g., 'See a GP within 1 week', 'Self-care with monitoring')",
  "status": "resolved",
  "watch_for": "Red-flag symptoms the user should watch for",
  "response_to_user": "A conversational message wrapping up the assessment and sharing the recommendation. Include the CTAS level naturally."
}}

Rules:
- Assessment should be informative but not alarming
- Recommended action should be specific and actionable
- Response to user should be warm and conversational
- Include the CTAS level in your response to user naturally"""

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=prompt,
    )
    result = _parse_json(response.text)

    # Ensure required fields with triage fallbacks
    result.setdefault("ctas_level", triage_result["ctas_level"])
    result.setdefault("ctas_label", triage_result["ctas_label"])
    result.setdefault("assessment", "Assessment completed.")
    result.setdefault("recommended_action", "Monitor symptoms.")
    result.setdefault("status", "resolved")
    result.setdefault("watch_for", "")
    result.setdefault("response_to_user", "Your assessment is complete.")

    return result
