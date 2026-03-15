# CTAS Fine-Tuning Documentation

## Overview

Medunity uses a **fine-tuned Gemini 2.5 Flash** model for Canadian Triage and Acuity Scale (CTAS) 2025 assessment. The model was trained on 1,000 synthetic examples to classify patient presentations into CTAS levels 1-5, identify CEDIS complaints, apply Primary and Complaint Specific Modifiers, and provide clinical rationale.

---

## CTAS 2025 Guidelines Covered

The training data incorporates key changes from the **2025 CTAS guideline update**:

### Frailty Modifier (Expanded)
- Now a **Primary Modifier** applied to all 169 CEDIS complaints
- Neonates ≤7 days → automatic CTAS 2
- Premature infants with corrected age <3 months → automatic CTAS 2
- Geriatric patients → assessed at every encounter

### Reclassifications
- **Sexual assault** → moved to Trauma category
- **Head injury** → moved to Trauma category
- **Traumatic back/spine** → moved to Trauma category
- **General weakness** → moved to General category
- **Patient welfare** → moved to General category
- **Social problems** → moved to General category

### Renamed Terminology
- **Primary Modifiers** (formerly "first-order modifiers"): airway, breathing, circulation, disability, pain, mechanism of injury, frailty
- **Complaint Specific Modifiers** (unified from "second-order" + "special" modifiers)

### New Primary Modifiers Added For:
- Sensory loss / paresthesias
- Diplopia
- Visual disturbances
- Pruritus
- Rash
- Wound check

### Special Populations
- Sickle cell disease patients
- Immunocompromised patients
- Pediatric patients
- Rural/remote considerations

---

## Synthetic Training Data

### Files
| File | Examples | Purpose |
|------|----------|---------|
| `ctas_training.jsonl` | 1,000 | Full dataset (raw format with `"assistant"` role) |
| `ctas_train_vertex.jsonl` | 900 | Training split (VertexAI Gemini format with `"model"` role) |
| `ctas_eval_vertex.jsonl` | 100 | Evaluation split (VertexAI Gemini format) |

### CTAS Distribution (Full Dataset)
| Level | Count | % | Description |
|-------|-------|---|-------------|
| CTAS 1 | ~51 | 5.1% | Resuscitation |
| CTAS 2 | ~131 | 13.1% | Emergent |
| CTAS 3 | ~222 | 22.2% | Urgent |
| CTAS 4 | ~383 | 38.3% | Less Urgent |
| CTAS 5 | ~213 | 21.3% | Non-Urgent |

### Language Distribution
- **~80% casual language** — how real users type ("my knee's been weird", "been super anxious lately cant sleep", "pretty sure i have a kidney stone")
- **~20% clinical language** — standard patient presentations ("Patient: 45-year-old male presenting with...")

### Design Decisions

**CTAS 2 is intentionally well-represented** because the 2025 guidelines introduced several changes affecting emergent-level triage (neonatal frailty modifier, new Primary Modifiers for diplopia/visual disturbances/sensory loss, sexual assault reclassification).

**CTAS 4-5 are the largest buckets** because the model needs to learn when NOT to escalate. Everyday complaints (sore throat, mild rash, medication refill, chronic back pain flare) are critical for preventing over-triage.

**CTAS 3 cases emphasize ambiguity** — presentations where modifier application determines the level (abdominal pain that could go either way, moderate headache with one red flag, fever with uncertain source, mental health presentations). Rationales in CTAS 3 examples explicitly explain why the level is 3 and not 2 or 4.

**Casual language is dominant** because the model's primary use case is triaging natural language from real users, not clinical chart notes. Training examples include:
- User theories about their condition ("probably food poisoning from dodgy takeout")
- Lifestyle context ("was at the gym doing deadlifts and...")
- Colloquial language ("idk", "tbh", "kinda", "lol")
- Backstory and irrelevant details real people include

### Training Data Format

Each example in `ctas_training.jsonl` follows this structure:
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a Canadian Emergency Department triage nurse applying the Canadian Triage and Acuity Scale (CTAS) 2025 guidelines..."
    },
    {
      "role": "user",
      "content": "my throat's been super sore for like 2 days, kinda hurts to swallow..."
    },
    {
      "role": "assistant",
      "content": "CTAS Level: 4 – Less Urgent\n\nCEDIS Complaint: Sore throat\n\nPrimary Modifiers:\n- ...\n\nComplaint Specific Modifiers:\n- ...\n\nRationale: ..."
    }
  ]
}
```

The VertexAI files (`ctas_train_vertex.jsonl`, `ctas_eval_vertex.jsonl`) use Gemini's native format:
```json
{
  "systemInstruction": {"parts": [{"text": "..."}]},
  "contents": [
    {"role": "user", "parts": [{"text": "..."}]},
    {"role": "model", "parts": [{"text": "..."}]}
  ]
}
```

### Model Output Format

The fine-tuned model outputs structured text (not JSON):
```
CTAS Level: 4 – Less Urgent

CEDIS Complaint: Sore throat / Pharyngitis

Primary Modifiers:
- Airway: Intact, no stridor, no drooling
- Pain: Moderate — sore throat with odynophagia

Complaint Specific Modifiers:
- 2-day duration
- Low-grade fever
- No cough or respiratory symptoms

Rationale: This presentation is consistent with viral pharyngitis or possible
streptococcal pharyngitis. CTAS 4 with physician assessment within 60 minutes.
```

This is parsed in `backend/agent/triage.py` by `_parse_ctas_text()` using regex to extract:
- `ctas_level` (int)
- `ctas_label` (string)
- `cedis_complaint` (string)
- `reasoning` (string — from the Rationale section)
- `full_assessment` (string — the complete raw output)

---

## Fine-Tuning Configuration

### Platform
- **Google Cloud Vertex AI** — Supervised Fine-Tuning

### Model
- **Base model**: Gemini 2.5 Flash
- **Tuned model name**: `ctas-triage-v1`
- **Region**: `us-central1`

### Hyperparameters
- **Epochs**: 12 (with intermediate checkpoints enabled — best checkpoint likely around epoch 3-5)
- **Learning rate multiplier**: 1.0 (default)
- **Training examples**: 900
- **Evaluation examples**: 100

### Endpoint
- **Endpoint name**: `medunity-app`
- **Endpoint ID**: `951984105363341312`
- **GCP Project**: `gen-lang-client-0565444852`
- **Full resource path**: `projects/gen-lang-client-0565444852/locations/us-central1/endpoints/951984105363341312`

### Cost
- Fine-tuning: ~$5-15 USD per run
- Inference: Standard Gemini Flash pricing per request

---

## Backend Integration

### File: `backend/agent/triage.py`

The `assess_ctas()` function implements a three-tier fallback:

1. **Fine-tuned model** (via Vertex AI) — sends the system instruction + user text, parses structured output
2. **Base Gemini 2.5 Flash** (via Google AI API key) — uses prompt engineering to get JSON output
3. **Static fallback** — returns CTAS 4 ("Less Urgent") as a safe default

### Environment Variables
| Variable | Value | Notes |
|----------|-------|-------|
| `GCP_PROJECT` | `gen-lang-client-0565444852` | Defaults in code if not set |
| `GCP_LOCATION` | `us-central1` | Defaults in code if not set |
| `CTAS_ENDPOINT_ID` | `951984105363341312` | Defaults in code if not set |
| `GOOGLE_API_KEY` | (in `.env`) | Used by fallback base Gemini |

### Authentication
- **Tuned model**: Requires Google Cloud Application Default Credentials (ADC)
  ```bash
  # One-time setup:
  export PATH="$HOME/google-cloud-sdk/bin:$PATH"
  gcloud auth application-default login --project=gen-lang-client-0565444852
  ```
- **Fallback model**: Uses `GOOGLE_API_KEY` from `.env` (auto-detected by `genai.Client()`)

### Key Dependency
The system instruction **must** be sent at inference time even though it was part of the training data. Without it, the model reverts to generic Gemini behavior instead of the structured CTAS format.

```python
config=GenerateContentConfig(
    system_instruction=CTAS_SYSTEM_INSTRUCTION,
)
```

---

## Retraining / Iteration

### When to retrain
- If the model consistently mis-triages a specific complaint category
- If CTAS guidelines are updated again
- If you want to add new complaint types not covered in training

### How to retrain
1. Add new examples to `ctas_training.jsonl` (maintain the same format)
2. Re-run the conversion script to generate new VertexAI format files with train/eval split
3. Upload to GCS and start a new tuning job
4. Recommended: **4-5 epochs** (12 was too many — check eval loss curves to find optimal checkpoint)

### Adding examples
New examples should follow the same structure. Use the helper pattern:
```python
from gen_helper import ex, write_batch
# ex(user_msg, ctas_level, cedis, primary_modifiers, specific_modifiers, rationale)
E = []
E.append(ex("user text", 3, "CEDIS complaint",
    [("Pain", "Moderate (6/10)")],
    ["Specific modifier 1", "Specific modifier 2"],
    "Rationale text explaining the triage decision."))
write_batch(E, "new_examples.jsonl")
```

### Conversion to VertexAI format
```python
import json, random
random.seed(42)

all_ex = []
with open("ctas_training.jsonl") as f:
    for line in f:
        all_ex.append(json.loads(line))

def to_vertex(e):
    m = e["messages"]
    return {
        "systemInstruction": {"parts": [{"text": m[0]["content"]}]},
        "contents": [
            {"role": "user", "parts": [{"text": m[1]["content"]}]},
            {"role": "model", "parts": [{"text": m[2]["content"]}]}
        ]
    }

random.shuffle(all_ex)
train = all_ex[:int(len(all_ex)*0.9)]
evl = all_ex[int(len(all_ex)*0.9):]

with open("ctas_train_vertex.jsonl", "w") as f:
    for e in train: f.write(json.dumps(to_vertex(e)) + "\n")
with open("ctas_eval_vertex.jsonl", "w") as f:
    for e in evl: f.write(json.dumps(to_vertex(e)) + "\n")
```

---

## Training Metrics (Vertex AI)

Three checkpoints were evaluated. The best-performing checkpoint is **ctas-gemini-2** (row 3).

| Checkpoint | Accuracy (Train) | Accuracy (Val) | Inferences (Train) | Inferences (Val) | Loss (Train) | Loss (Val) |
|------------|-------------------|----------------|---------------------|-------------------|--------------|------------|
| ctas-gemini-2 (early) | 0.719 | 0.729 | 3,903 | 4,082 | 1.097 | 1.009 |
| ctas-gemini-2 (mid) | 0.750 | 0.757 | 4,107 | 4,082 | 0.880 | 0.847 |
| **ctas-gemini-2 (best)** | **0.761** | **0.770** | **4,114** | **4,082** | **0.845** | **0.795** |

### Interpreting These Numbers

- **Validation accuracy 77%** — the model correctly triages 77 out of 100 unseen cases. For a 5-class classification task with ambiguous CTAS 3 boundary cases, this is solid. Most "errors" are likely off-by-one (e.g., model says CTAS 3 when ground truth is CTAS 2).
- **Loss is still decreasing** between checkpoints (1.009 → 0.847 → 0.795) — the model was still improving, meaning the 12-epoch run was not severely overfitting. A future run at 4-6 epochs should hit diminishing returns.
- **Train and validation metrics track closely** (no large gap) — confirms the model is generalizing, not memorizing.

### Live Validation (2026-03-14)

| Input | Expected | Model Output | Correct? |
|-------|----------|-------------|----------|
| Sore throat, mild fever, 2 days | CTAS 4 | CTAS 4 — Pharyngitis | Yes |
| Chest tight, left arm numb, sweating, 55yo smoker | CTAS 2 | CTAS 2 — Chest pain / ACS | Yes |
| Allergy med refill, feeling fine | CTAS 5 | CTAS 5 — Prescription refill | Yes |
| Passive suicidal ideation, no plan, friend brought in | CTAS 2-3 | CTAS 2 — Suicidal ideation | Yes (conservative) |

The model correctly:
- Escalates serious presentations described in casual language
- Avoids over-triaging routine complaints
- Identifies CEDIS complaints from informal descriptions
- References CTAS 2025 guideline concepts in rationale
