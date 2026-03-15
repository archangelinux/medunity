import json
import os
import re
from google import genai
from google.genai.types import GenerateContentConfig

# --- Config ---
GCP_PROJECT = os.getenv("GCP_PROJECT", "gen-lang-client-0565444852")
GCP_LOCATION = os.getenv("GCP_LOCATION", "us-central1")
CTAS_ENDPOINT_ID = os.getenv("CTAS_ENDPOINT_ID", "951984105363341312")
FALLBACK_MODEL = "gemini-2.5-flash"

# System instruction baked into training data — must also be sent at inference
CTAS_SYSTEM_INSTRUCTION = (
    "You are a Canadian Emergency Department triage nurse applying the Canadian Triage "
    "and Acuity Scale (CTAS) 2025 guidelines. Assign a CTAS level (1-5), identify the "
    "CEDIS complaint, apply relevant Primary Modifiers (airway, breathing, circulation, "
    "disability, pain, mechanism of injury, frailty) and Complaint Specific Modifiers, "
    "and provide a brief clinical rationale. Always document your triage decision clearly "
    "per enhanced documentation standards."
)

CTAS_LABELS = {
    1: "Resuscitation",
    2: "Emergent",
    3: "Urgent",
    4: "Less Urgent",
    5: "Non-Urgent",
}

# Fallback prompt (used when tuned model is unavailable)
CTAS_GUIDELINES = """You are a Canadian Triage and Acuity Scale (CTAS) assessor. You must triage accurately — neither over-triaging nor under-triaging.

CTAS Levels:
1 - Resuscitation: Immediate threat to life (cardiac arrest, major trauma, severe respiratory distress, anaphylaxis, GCS ≤8)
2 - Emergent: Potential threat to life or limb (chest pain with cardiac features, acute stroke signs, severe allergic reaction, active hemorrhage, overdose with altered LOC)
3 - Urgent: Could progress to serious problem (moderate-severe pain 7+/10, persistent vomiting with dehydration, high fever >39°C, asthma not responding to home treatment, abdominal pain with guarding)
4 - Less Urgent: Conditions that benefit from assessment within 1-2 hours (mild-moderate pain <7/10, headache without red flags, earache, sore throat, UTI symptoms, minor injuries with normal function, low-grade fever <39°C)
5 - Non-Urgent: Conditions that can wait or be self-managed (minor scratches, chronic stable conditions, mild cold symptoms, prescription renewals, insect bites without allergy)

CRITICAL calibration examples:
- "Dull headache and nausea, didn't sleep well" → CTAS 4 (no red flags)
- "Worst headache of my life, sudden onset" → CTAS 2 (possible SAH)
- "Headache with stiff neck and fever 39.5°C" → CTAS 2-3 (meningitis concern)
- "Sore throat and cough for 2 days" → CTAS 5
- "Chest pain radiating to jaw, sweating" → CTAS 2
- "Twisted ankle, can bear weight" → CTAS 4
- "Abdominal pain 8/10, vomiting blood" → CTAS 2

Assess based on:
- Symptom severity and acuity (pain scale, vital signs mentioned)
- Presence of red-flag symptoms (not just the symptom name — the CONTEXT matters)
- Duration and progression
- Do NOT over-triage based on symptom names alone. "Headache" is not automatically urgent.

Return your assessment as JSON with these fields:
- ctas_level: integer 1-5
- ctas_label: string (e.g. "Less Urgent", "Non-Urgent")
- reasoning: brief clinical reasoning for the level assignment
"""


def _parse_ctas_text(text: str) -> dict:
    """Parse the fine-tuned model's structured text into a dict."""
    level_match = re.search(r"CTAS Level:\s*(\d)", text)
    level = int(level_match.group(1)) if level_match else 4

    rationale_match = re.search(r"Rationale:\s*(.+)", text, re.DOTALL)
    reasoning = rationale_match.group(1).strip() if rationale_match else text

    cedis_match = re.search(r"CEDIS Complaint:\s*(.+?)(?:\n|$)", text)
    cedis = cedis_match.group(1).strip() if cedis_match else None

    return {
        "ctas_level": level,
        "ctas_label": CTAS_LABELS.get(level, "Less Urgent"),
        "reasoning": reasoning,
        "cedis_complaint": cedis,
        "full_assessment": text,
    }


def _parse_json(text: str) -> dict:
    """Parse JSON from base model (fallback)."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)
    return json.loads(cleaned)


async def assess_ctas(structured_presentation: str) -> dict:
    """Assess CTAS level using fine-tuned VertexAI model, fallback to base Gemini."""

    # --- Try fine-tuned model via Vertex AI ---
    try:
        vertex_client = genai.Client(
            vertexai=True,
            project=GCP_PROJECT,
            location=GCP_LOCATION,
        )
        tuned_model = f"projects/{GCP_PROJECT}/locations/{GCP_LOCATION}/endpoints/{CTAS_ENDPOINT_ID}"
        response = await vertex_client.aio.models.generate_content(
            model=tuned_model,
            contents=structured_presentation,
            config=GenerateContentConfig(
                system_instruction=CTAS_SYSTEM_INSTRUCTION,
            ),
        )
        result = _parse_ctas_text(response.text)
        result["model"] = "ctas-triage-v1"
        return result

    except Exception as e:
        print(f"[triage] Tuned model failed: {e}")
        print("[triage] Falling back to base Gemini")

    # --- Fallback: base Gemini with prompt engineering ---
    try:
        client = genai.Client()
        prompt = f"""{CTAS_GUIDELINES}

Patient presentation:
{structured_presentation}

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON."""

        response = await client.aio.models.generate_content(
            model=FALLBACK_MODEL,
            contents=prompt,
        )
        parsed = _parse_json(response.text)
        level = int(parsed.get("ctas_level", 4))
        return {
            "ctas_level": level,
            "ctas_label": parsed.get("ctas_label", CTAS_LABELS.get(level, "Less Urgent")),
            "reasoning": parsed.get("reasoning", ""),
            "model": "gemini-2.5-flash-fallback",
        }
    except Exception as e:
        print(f"[triage] Fallback model also failed: {e}")
        return {
            "ctas_level": 4,
            "ctas_label": "Less Urgent",
            "reasoning": "Unable to assess — defaulting to CTAS 4 for safety.",
            "model": "default-fallback",
        }
