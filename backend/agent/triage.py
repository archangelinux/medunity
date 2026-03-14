import json
from google import genai

TRIAGE_MODEL = "gemini-2.5-flash"

CTAS_GUIDELINES = """You are a Canadian Triage and Acuity Scale (CTAS) assessor.

CTAS Levels:
1 - Resuscitation: Immediate threat to life (cardiac arrest, major trauma, severe respiratory distress)
2 - Emergent: Potential threat to life or limb (chest pain, stroke symptoms, severe bleeding, altered consciousness)
3 - Urgent: Could progress to serious problem (moderate pain, persistent vomiting, high fever with other symptoms, asthma exacerbation)
4 - Less Urgent: Conditions that benefit from assessment within 1-2 hours (mild-moderate pain, minor injuries, ear/throat infections, recurring manageable symptoms)
5 - Non-Urgent: Conditions that can wait or be self-managed (minor scratches, chronic stable conditions, mild cold symptoms, prescription renewals)

Assess based on:
- Symptom severity and acuity
- Presence of red-flag symptoms
- Duration and progression
- Associated symptoms that change risk profile
- Patient history context if available

Return your assessment as JSON with these fields:
- ctas_level: integer 1-5
- ctas_label: string (e.g. "Less Urgent", "Non-Urgent")
- reasoning: brief clinical reasoning for the level assignment
"""

CTAS_LABELS = {
    1: "Resuscitation",
    2: "Emergent",
    3: "Urgent",
    4: "Less Urgent",
    5: "Non-Urgent",
}


def _parse_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = lines[1:]  # remove opening fence
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)
    return json.loads(cleaned)


async def assess_ctas(structured_presentation: str) -> dict:
    """Assess CTAS level for a structured symptom presentation.

    For now: Gemini does triage. Later: swap to Modal fine-tuned model endpoint.
    """
    client = genai.Client()

    prompt = f"""{CTAS_GUIDELINES}

Patient presentation:
{structured_presentation}

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON."""

    response = await client.aio.models.generate_content(
        model=TRIAGE_MODEL,
        contents=prompt,
    )
    result = _parse_json(response.text)

    level = int(result.get("ctas_level", 4))
    return {
        "ctas_level": level,
        "ctas_label": result.get("ctas_label", CTAS_LABELS.get(level, "Less Urgent")),
        "reasoning": result.get("reasoning", ""),
    }
