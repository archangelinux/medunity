# Medunity — Complete Hackathon Build Plan (Revised)

> **Healthcare is fragmented. Medunity brings it together.**

---

## What You're Building

A longitudinal health agent with two integrated modes:

**Mode 1 — Symptom Intelligence:** You message Medunity when something bothers you (text or photos). It doesn't treat each message as a new conversation — it builds a symptom timeline and watches for patterns. When it detects a trajectory crossing from "annoying" to "clinically significant," it escalates to Mode 2.

**Mode 2 — Triage + Real-Time Care Routing:** Triggered by Mode 1 escalation or an acute "something's wrong right now" situation. Assesses urgency via a fine-tuned triage model, then finds your best care option (walk-in, ER, urgent care, after-hours clinic, telehealth) ranked by real-time wait times, hours, and distance.

**Treatment Continuity Layer:** After your visit, you tell Medunity what happened. It tracks follow-through — prescriptions, referrals, blood work — with context-aware nudges.

---

## Sponsor Track Fit

**Sun Life — Best Health Care Hack Using Agentic AI**
- Symptom management: longitudinal tracking with pattern recognition
- Treatment tracking: post-visit follow-through with context-aware nudges
- Prevention: catches escalating patterns before they become emergencies
- Agentic: detects patterns autonomously, finds clinics, schedules follow-ups

**Google — Best AI for Community Impact**
- 6.5M+ Canadians don't have a family doctor — Medunity fills the continuity gap
- Reduces unnecessary ER visits (healthcare system sustainability)
- Disproportionately helps underserved populations: newcomers, shift workers, students

---

## Architecture

```
User (text/photos)
    │
    ▼
┌─────────────────────────────────────┐
│  Orchestration Agent (Gemini 3    │
│  Flash via API)                     │
│                                     │
│  - Manages full conversation history│
│  - Extracts symptoms from casual    │
│    language → structured clinical   │
│    presentation                     │
│  - Detects concerning patterns      │
│    over time                        │
│  - Parses treatment plans           │
│  - Generates follow-up nudges       │
│  - Calls tools via function calling │
└──────────┬──────────────────────────┘
           │ (function calls)
     ┌─────┼──────────┐
     ▼     ▼          ▼
┌────────┐┌─────────┐┌──────────────┐
│Triage  ││Symptom  ││Care Router   │
│Model   ││Logger   ││              │
│        ││(DB)     ││- er-watch.ca │
│Fine-   ││         ││- medimap.ca  │
│tuned   ││         ││- Google Maps │
│Qwen3-8B││         ││              │
│on Modal││         ││(Modal scrape)│
└────────┘└─────────┘└──────────────┘
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Fine-tuning infra | Modal (A100 80GB) + Unsloth | ~$3-5 total. Unsloth = 2x faster, 60% less VRAM |
| Base model to fine-tune | Qwen3-8B (Apache 2.0) | Best 8B model as of early 2026. Strong reasoning, thinking mode, great Unsloth support |
| Orchestration LLM | Gemini 3 Flash API | Fast, cheap, 1M context. Use your Gemini credits. Function calling built-in |
| Backend | FastAPI (Python) | Simple, fast to build |
| Frontend | Next.js + Tailwind (or plain React) | Chat UI + symptom timeline + care routing cards |
| Database | Supabase (free tier, Postgres) | conversations, symptoms, treatments, clinics |
| Model serving | Modal serverless endpoint (vLLM) | Serve fine-tuned model |
| Clinic data | Modal serverless functions | Fan-out parallel scraping |

---

## TRAINING DATA STRATEGY

### The Problem

The ideal dataset (MIETIC on PhysioNet) requires credentialing that takes days to weeks. You cannot rely on getting access before a weekend hackathon.

### The Solution: Synthetic Generation Grounded in Official CTAS Guidelines

This is a legitimate, defensible approach. MIETIC itself was generated using GPT-4o from MIMIC-IV data. Multiple published papers use LLM-generated synthetic medical data for training. The key is grounding it in real clinical guidelines.

**Source material (all freely available, no credentialing):**

1. **CTAS Participant Manual v2.5** (2013): http://ctas-phctas.ca/wp-content/uploads/2018/05/participant_manual_v2.5b_november_2013_0.pdf
   - Contains: all 5 CTAS levels with definitions, 165+ CEDIS presenting complaints across 17 complaint groups, first-order modifiers (vital signs, pain, mechanism of injury), second-order modifiers (complaint-specific), time objectives per level, detailed clinical examples

2. **Ontario Prehospital CTAS Paramedic Guide v2.0**: https://files.ontario.ca/moh_3/moh-manuals-prehospital-ctas-paramedic-guide-v2-0-en-2016-12-31.pdf
   - Contains: 16 complaint categories, all modifier tables (33 tables), common presentations per level, clinical reasoning examples

3. **CTAS 2016 Revisions** (Cambridge Core, open access): the 2016 revision paper with updated modifiers

4. **Supplementary: syntech-ai/medical-triage-500** on Hugging Face — 500 synthetic triage cases with structured fields (symptoms, risk assessment, urgency classification). Small but can be mixed in.

### Step-by-Step: Generate Training Data

**Step 1: Download and process the CTAS PDFs**

Download both PDFs above. Extract the key structured information:
- All 5 CTAS level definitions with time objectives
- The 165 CEDIS presenting complaints
- All first-order modifier tables (vital signs, pain, mechanism of injury)
- All second-order modifier tables (complaint-specific)
- Clinical examples from the manual

**Step 2: Build the generation prompt**

Use Claude (your Claude Max subscription) to generate training examples. Here's the exact prompt:

```
You are generating training data for a medical triage model. Your goal is to create realistic patient presentations paired with CTAS (Canadian Triage and Acuity Scale) triage assessments.

CTAS REFERENCE:
[Paste the full CTAS level definitions, modifier tables, and complaint categories from the PDFs here — this will be long, ~5000-10000 tokens. That's fine.]

For each example, generate:

1. A PATIENT PRESENTATION in natural clinical language. Include:
   - Age and gender
   - Chief complaint (from CEDIS list)
   - Symptom description (onset, duration, severity, associated symptoms)
   - Relevant vital signs (when appropriate)
   - Relevant medical history (when appropriate)
   - Pain level (when appropriate)
   
   Vary the complexity: some should be straightforward (chest pain + cardiac features = CTAS 2), others should require reasoning across multiple modifiers.

2. A TRIAGE ASSESSMENT that includes:
   - CTAS Level (1-5) with the level name (Resuscitation/Emergent/Urgent/Less Urgent/Non-Urgent)
   - Time objective (e.g., "immediate", "within 15 minutes", "within 30 minutes", "within 60 minutes", "within 120 minutes")
   - Recommended care setting (ER immediate, ER standard, Urgent Care, Walk-in Clinic, Telehealth, Pharmacy/Self-care)
   - Clinical reasoning: step-by-step explanation of how you arrived at this CTAS level, referencing the specific modifiers used
   - Key red flags identified (if any)

IMPORTANT REQUIREMENTS:
- Generate a balanced distribution across all 5 CTAS levels (roughly 15% Level 1, 20% Level 2, 30% Level 3, 20% Level 4, 15% Level 5)
- Include diverse demographics (ages 2-90, all genders)
- Include presentations that require modifier application (not just obvious ones)
- Include some ambiguous cases where reasoning is important
- Make presentations realistic — not textbook-perfect. Include some vague symptoms, incomplete histories, etc.
- Include some mental health presentations (CTAS has specific mental health modifiers)
- Include some pediatric presentations
- Include some pregnancy-related presentations

Generate 50 examples in this exact JSON format:
{
  "messages": [
    {
      "role": "system",
      "content": "You are a CTAS-trained triage specialist. Given a patient presentation, assess the CTAS level (1-5), provide a time window for care, recommend the appropriate care setting, and explain your clinical reasoning step by step. Be decisive."
    },
    {
      "role": "user",
      "content": "[patient presentation]"
    },
    {
      "role": "assistant", 
      "content": "[triage assessment with CTAS level, time objective, care setting, reasoning, and red flags]"
    }
  ]
}

Output ONLY valid JSON array. No markdown, no commentary.
```

**Step 3: Generate in batches**

Run this prompt ~40 times with Claude, generating 50 examples per batch = **~2,000 examples**. Between batches, vary:
- "Focus this batch on cardiovascular presentations"
- "Focus this batch on pediatric presentations"
- "Focus this batch on mental health presentations"
- "Focus this batch on musculoskeletal/trauma presentations"
- "Focus this batch on respiratory presentations"
- "Focus this batch on gastrointestinal presentations"
- "Focus this batch on ambiguous cases requiring careful modifier application"
- "Focus this batch on elderly patients with complex histories"

**Step 4: Quality check and deduplicate**

```python
import json
from collections import Counter

# Load all generated examples
all_examples = []
for i in range(40):
    with open(f"batch_{i}.json") as f:
        batch = json.load(f)
        all_examples.extend(batch)

# Check CTAS level distribution
levels = []
for ex in all_examples:
    assistant_msg = ex["messages"][2]["content"]
    # Parse out CTAS level (you may need to adjust this based on output format)
    for level in ["CTAS Level 1", "CTAS Level 2", "CTAS Level 3", "CTAS Level 4", "CTAS Level 5"]:
        if level in assistant_msg:
            levels.append(level)
            break

print("Distribution:", Counter(levels))

# Remove any malformed examples
clean = [ex for ex in all_examples if len(ex["messages"]) == 3]

# Save
with open("triage_train.jsonl", "w") as f:
    for ex in clean:
        f.write(json.dumps(ex) + "\n")

print(f"Total clean examples: {len(clean)}")
```

**Step 5: Supplement with syntech-ai/medical-triage-500**

Download and convert the 500 HuggingFace examples to the same chat format. Add to your training set.

**Target: ~2,000-2,500 training examples total.**

This is enough for QLoRA fine-tuning to produce meaningful improvement over base model prompting, especially because:
- The data is tightly focused on one task (triage classification)
- The reasoning chains teach the model *how* to apply CTAS modifiers
- The base model (Qwen3-8B) is already strong at medical reasoning

### Pitch to judges about synthetic data:

> "We generated our training dataset using frontier LLMs grounded in the official CTAS clinical guidelines — the same methodology used by MIETIC, the leading triage instruction corpus published on PhysioNet. Our dataset covers all 17 CEDIS complaint categories, all 5 CTAS levels with balanced distribution, and includes the full modifier system (vital signs, pain, mechanism of injury, and complaint-specific second-order modifiers). We validated our model's outputs against clinical examples from the CTAS implementation manual."

---

## FINE-TUNING: Step-by-Step

### Why Qwen3-8B

- Best 8B-class model as of early 2026 (outperforms Llama 3.1 8B, Mistral 7B on reasoning benchmarks)
- Built-in thinking mode (/think, /no_think) — perfect for chain-of-thought triage reasoning
- Apache 2.0 license (no branding requirements unlike Llama's "Built with Llama")
- Excellent Unsloth support with published notebooks and documentation
- Strong instruction following out of the box

### Fine-Tuning Script (Modal + Unsloth)

**File: `finetune.py`**

```python
import modal

app = modal.App("medunity-finetune")
vol = modal.Volume.from_name("medunity-model", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "unsloth[cu124-ampere-torch250] @ git+https://github.com/unslothai/unsloth.git",
        "datasets",
        "trl>=0.12.0",
        "transformers>=4.46.0",
        "torch>=2.5.0",
    )
)

@app.function(
    image=image,
    gpu=modal.gpu.A100(size="80GB"),
    timeout=7200,
    volumes={"/model": vol},
)
def train():
    from unsloth import FastLanguageModel
    from trl import SFTTrainer
    from transformers import TrainingArguments
    from datasets import load_dataset

    # 1. Load base model with Unsloth
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name="Qwen/Qwen3-8B",
        max_seq_length=2048,
        dtype=None,       # auto-detect (bf16 on A100)
        load_in_4bit=True, # QLoRA — 4-bit quantized base, 16-bit LoRA adapters
    )

    # 2. Add LoRA adapters
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_alpha=16,
        lora_dropout=0,       # Unsloth optimized — must be 0
        bias="none",
        use_gradient_checkpointing="unsloth",
    )

    # 3. Load training data
    dataset = load_dataset("json", data_files={
        "train": "/model/triage_train.jsonl",
    })

    # 4. Train
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset["train"],
        args=TrainingArguments(
            output_dir="/model/checkpoints",
            per_device_train_batch_size=4,
            gradient_accumulation_steps=4,  # effective batch size = 16
            warmup_steps=30,
            num_train_epochs=3,
            learning_rate=2e-4,
            bf16=True,
            logging_steps=10,
            save_strategy="epoch",
            optim="adamw_8bit",
            seed=42,
        ),
    )

    stats = trainer.train()
    print(f"Training complete. Final loss: {stats.training_loss:.4f}")

    # 5. Save LoRA adapter
    model.save_pretrained("/model/medunity-triage-lora")
    tokenizer.save_pretrained("/model/medunity-triage-lora")

    # 6. Save merged model for easier serving
    model.save_pretrained_merged(
        "/model/medunity-triage-merged",
        tokenizer,
        save_method="merged_16bit",
    )
    print("Saved merged model to /model/medunity-triage-merged")

@app.local_entrypoint()
def main():
    train.remote()
```

### Commands to run

```bash
# 1. Create Modal volume and upload training data
modal volume create medunity-model
modal volume put medunity-model triage_train.jsonl triage_train.jsonl

# 2. Run fine-tuning (~30-60 min on A100 80GB, ~$3-5)
modal run finetune.py

# 3. Verify the model was saved
modal volume ls medunity-model
```

### Serve the Fine-Tuned Model

**File: `serve_triage.py`**

```python
import modal

app = modal.App("medunity-triage")
vol = modal.Volume.from_name("medunity-model")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("vllm>=0.6.0", "transformers>=4.46.0", "torch>=2.5.0")
)

@app.cls(
    image=image,
    gpu=modal.gpu.A100(size="40GB"),
    volumes={"/model": vol},
    allow_concurrent_inputs=10,
    container_idle_timeout=300,  # keep warm for 5 min
)
class TriageModel:
    @modal.enter()
    def load(self):
        from vllm import LLM, SamplingParams
        self.llm = LLM(
            model="/model/medunity-triage-merged",
            max_model_len=2048,
            dtype="float16",
        )
        self.params = SamplingParams(
            temperature=0.3,   # low temp = consistent triage decisions
            max_tokens=512,
            stop=["<|im_end|>"],
        )

    @modal.web_endpoint(method="POST")
    def triage(self, data: dict) -> dict:
        """
        Input: {"presentation": "45-year-old male presenting with..."}
        Output: {"result": "CTAS Level 3 — Urgent..."}
        """
        presentation = data.get("presentation", "")
        
        prompt = (
            "<|im_start|>system\n"
            "You are a CTAS-trained triage specialist. Given a patient "
            "presentation, assess the CTAS level (1-5), provide a time "
            "window for care, recommend the appropriate care setting "
            "(ER/urgent care/walk-in/telehealth/self-care), and explain "
            "your clinical reasoning. Be decisive.\n"
            "<|im_end|>\n"
            f"<|im_start|>user\n{presentation}\n<|im_end|>\n"
            "<|im_start|>assistant\n"
        )
        
        result = self.llm.generate([prompt], self.params)
        return {"result": result[0].outputs[0].text}
```

```bash
# Deploy — gives you a URL endpoint
modal deploy serve_triage.py
# Output: https://YOUR_USERNAME--medunity-triage-triagemodel-triage.modal.run
```

**Test it:**
```bash
curl -X POST https://YOUR_ENDPOINT/triage \
  -H "Content-Type: application/json" \
  -d '{"presentation": "28-year-old female, sore throat for 5 days, low-grade fever 37.8C, no difficulty breathing, no rash, no joint pain, pain 4/10"}'
```

---

## CLINIC DATA SCRAPING

### Data Sources

| Source | What it has | Update frequency | Access |
|--------|-----------|-----------------|--------|
| er-watch.ca | Real-time ER wait times for 140+ Ontario hospitals | Every 15 min | Public website, scrapeable |
| medimap.ca | Walk-in clinic wait times, hours, locations across Canada | Live (clinic-reported) | Public website, scrapeable |
| howlongwilliwait.com | GTA ER wait times | Near real-time | Public website |
| Ontario.ca wait times | Historical ED wait time data | Monthly | Public data |

### Scraping Script (Modal)

**File: `scrape_clinics.py`**

```python
import modal
import json
from datetime import datetime

app = modal.App("medunity-scrape")
vol = modal.Volume.from_name("medunity-data", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("httpx", "beautifulsoup4", "lxml")
)

@app.function(image=image, timeout=120)
def scrape_er_watch():
    """Scrape er-watch.ca for Ontario ER wait times."""
    import httpx
    from bs4 import BeautifulSoup
    
    resp = httpx.get("https://www.er-watch.ca/", timeout=30, follow_redirects=True)
    soup = BeautifulSoup(resp.text, "lxml")
    
    # NOTE: You MUST inspect er-watch.ca's actual HTML structure during
    # hackathon prep. The selectors below are placeholders.
    # Open the site, right-click → Inspect Element, find the hospital cards.
    hospitals = []
    
    # Example pattern — adjust based on actual HTML:
    # for card in soup.select(".hospital-card"):
    #     hospitals.append({
    #         "name": card.select_one(".hospital-name").text.strip(),
    #         "wait_minutes": int(card.select_one(".wait-time").text.strip()),
    #         "address": card.select_one(".address").text.strip(),
    #         "type": "er",
    #     })
    
    return hospitals

@app.function(image=image, timeout=120)
def scrape_medimap(city: str):
    """Scrape medimap.ca for walk-in clinic data in a given city."""
    import httpx
    from bs4 import BeautifulSoup
    
    url = f"https://medimap.ca/en/walk-in-clinics/{city}"
    resp = httpx.get(url, timeout=30, follow_redirects=True)
    soup = BeautifulSoup(resp.text, "lxml")
    
    clinics = []
    # Same note: inspect actual HTML during prep
    # for card in soup.select(".clinic-card"):
    #     clinics.append({...})
    
    return clinics

@app.function(image=image, timeout=300, volumes={"/data": vol})
def refresh_all():
    """Fan-out scrape all sources, save to volume."""
    er_data = scrape_er_watch.remote()
    
    cities = ["toronto", "waterloo", "kitchener", "hamilton", 
              "mississauga", "brampton", "london"]
    clinic_futures = [scrape_medimap.remote(c) for c in cities]
    
    all_clinics = []
    for result in clinic_futures:
        all_clinics.extend(result)
    
    data = {
        "er_wait_times": er_data,
        "walk_in_clinics": all_clinics,
        "scraped_at": datetime.now().isoformat(),
    }
    
    with open("/data/clinic_data.json", "w") as f:
        json.dump(data, f, indent=2)
    
    vol.commit()
    print(f"Saved {len(er_data)} ERs, {len(all_clinics)} clinics")
    return data

@app.local_entrypoint()
def main():
    refresh_all.remote()
```

### CRITICAL: Hackathon Reality Check on Scraping

Scraping can fail during demos. Your mitigation plan:

1. **Before the hackathon:** Run the scraper, inspect the output, fix selectors
2. **During the hackathon:** Run it once Friday night, cache the results in Supabase
3. **For the demo:** Use cached data. Be transparent: "In production, Modal workers refresh this every 15 minutes. For the demo we're showing data from [timestamp]."
4. **Fallback:** If scraping totally fails, manually build a JSON file with ~30 real clinics/ERs in the KW/GTA area (names, addresses, hours from Google Maps). The routing logic still works.

---

## ORCHESTRATION AGENT (Gemini 3 Flash)

This is the brain that ties everything together.

### Gemini Function Calling Setup

```python
# agent.py — entry-based orchestration
import google.generativeai as genai
import httpx
import json
from datetime import datetime, timedelta
from supabase import create_client

genai.configure(api_key="YOUR_GEMINI_KEY")
supabase = create_client("YOUR_SUPABASE_URL", "YOUR_SUPABASE_KEY")
TRIAGE_ENDPOINT = "https://YOUR_MODAL_ENDPOINT/triage"

# Tools the agent can call
tools = [
    genai.protos.Tool(functions=[
        genai.protos.FunctionDeclaration(
            name="extract_symptoms",
            description="Extract structured symptoms from the user's entry text. Call this immediately when processing a new entry.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "symptoms": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(
                            type=genai.protos.Type.OBJECT,
                            properties={
                                "name": genai.protos.Schema(type=genai.protos.Type.STRING),
                                "severity": genai.protos.Schema(type=genai.protos.Type.STRING),
                                "duration": genai.protos.Schema(type=genai.protos.Type.STRING),
                                "body_area": genai.protos.Schema(type=genai.protos.Type.STRING),
                            },
                            required=["name"],
                        ),
                    ),
                },
                required=["symptoms"],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="get_recent_entries",
            description="Retrieve the user's recent entries to check for connections and patterns. Call this when processing a new entry.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "days_back": genai.protos.Schema(type=genai.protos.Type.NUMBER, description="How many days of history"),
                },
                required=["days_back"],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="assess_triage",
            description="Call the fine-tuned triage model to assess urgency. Translate all known symptoms into a structured clinical presentation first.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "structured_presentation": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Structured clinical presentation: age, gender, all symptoms with duration, vital signs if known, relevant history."
                    ),
                },
                required=["structured_presentation"],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="find_care_options",
            description="Search for available care options near the user. Call after triage assessment.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "care_type": genai.protos.Schema(type=genai.protos.Type.STRING, description="er, urgent_care, walk_in, telehealth"),
                    "max_wait_hours": genai.protos.Schema(type=genai.protos.Type.NUMBER),
                    "services_needed": genai.protos.Schema(type=genai.protos.Type.ARRAY, items=genai.protos.Schema(type=genai.protos.Type.STRING), description="e.g. ['blood_work', 'general']"),
                },
                required=["care_type", "max_wait_hours"],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="link_to_entry",
            description="Link the current entry to a previous entry when they're related (same symptoms, progression, follow-up).",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "previous_entry_id": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "reason": genai.protos.Schema(type=genai.protos.Type.STRING, description="Why they're linked"),
                },
                required=["previous_entry_id", "reason"],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="resolve_entry",
            description="Mark the entry as resolved with a final assessment. Call when you have enough info to score and summarize.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "ctas_level": genai.protos.Schema(type=genai.protos.Type.NUMBER, description="1-5"),
                    "ctas_label": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "assessment": genai.protos.Schema(type=genai.protos.Type.STRING, description="1-2 sentence assessment summary"),
                    "recommended_action": genai.protos.Schema(type=genai.protos.Type.STRING, description="What the user should do"),
                    "status": genai.protos.Schema(type=genai.protos.Type.STRING, description="resolved, watching, or escalated"),
                },
                required=["ctas_level", "ctas_label", "assessment", "recommended_action", "status"],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="generate_overview",
            description="Regenerate the user's health overview after an entry resolves. Analyzes all recent entries for patterns.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "status_summary": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "pattern_alerts": genai.protos.Schema(type=genai.protos.Type.ARRAY, items=genai.protos.Schema(type=genai.protos.Type.STRING)),
                },
                required=["status_summary"],
            ),
        ),
    ]),
]

SYSTEM_PROMPT = """You are the Medunity agent. You process health entries from users.

WHEN A NEW ENTRY IS SUBMITTED, follow this pipeline:
1. Call extract_symptoms to pull structured symptoms from the user's text
2. Call get_recent_entries to check the last 30 days for related entries
3. If you find related previous entries, call link_to_entry
4. Ask 2-5 targeted follow-up questions (ONLY questions that would change the clinical picture)
5. After the user answers, call assess_triage with a structured clinical presentation
6. Call resolve_entry with the CTAS score, assessment, and recommended action
7. Call generate_overview to update the user's health snapshot

FOLLOW-UP QUESTION RULES:
- Ask about things that would CHANGE the urgency level (CTAS modifiers)
- If previous entries exist, ask about them: "Is the [X] from [date] still happening?"
- Ask about the COMBINATION of symptoms, not each one independently
- Max 2-5 questions, then resolve. Don't drag it out.

ASSESSMENT RULES:
- Be decisive, not wishy-washy. "This warrants seeing a doctor" not "you might want to consider..."
- Always give a specific action: "See a GP within 1 week", "ER within 2 hours", "Monitor for 48 hours"
- The CTAS score should reflect the fine-tuned model output, not your own guess
- Note what would change the picture: "Update if fever develops or pain worsens"

INPUT TRANSLATION:
- Users write casually: "my knee's been weird"
- The triage model expects structured input: "28F presenting with knee pain, onset 3 days ago..."
- YOU do this translation inside the assess_triage call
"""


class MedunityAgent:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.current_entry_id = None
        self.model = genai.GenerativeModel(
            "gemini-3-flash-preview",
            system_instruction=SYSTEM_PROMPT,
            tools=tools,
        )
    
    async def process_new_entry(self, entry_text: str, photo_url: str = None) -> dict:
        """Process a new user entry. Returns the entry card data."""
        
        # Create entry in DB
        entry = supabase.table("entries").insert({
            "user_id": self.user_id,
            "raw_text": entry_text,
            "photo_url": photo_url,
            "status": "active",
        }).execute()
        self.current_entry_id = entry.data[0]["id"]
        
        # Start a new chat session for this entry's thread
        chat = self.model.start_chat()
        
        # Send the entry to the agent — it will call extract_symptoms + get_recent_entries
        response = chat.send_message(
            f"New entry from user: \"{entry_text}\"\n"
            f"Entry ID: {self.current_entry_id}\n"
            f"Process this entry: extract symptoms, check history, ask follow-ups."
        )
        
        # Handle function calls in a loop
        response = await self._handle_tool_loop(chat, response)
        
        # The response now contains follow-up questions
        # Store the agent's message in the thread
        supabase.table("thread_messages").insert({
            "entry_id": self.current_entry_id,
            "role": "assistant",
            "content": response.text,
        }).execute()
        
        return {
            "entry_id": self.current_entry_id,
            "agent_response": response.text,
            "status": "active",
        }
    
    async def respond_in_thread(self, entry_id: str, user_message: str) -> dict:
        """Handle user's response within an entry thread."""
        self.current_entry_id = entry_id
        
        # Load thread history
        messages = supabase.table("thread_messages").select("*").eq(
            "entry_id", entry_id
        ).order("created_at").execute()
        
        # Rebuild chat with history
        chat = self.model.start_chat(history=[
            {"role": msg["role"], "parts": [msg["content"]]}
            for msg in messages.data
        ])
        
        # Store user's response
        supabase.table("thread_messages").insert({
            "entry_id": entry_id,
            "role": "user",
            "content": user_message,
        }).execute()
        
        # Send to agent — it may call assess_triage + resolve_entry
        response = chat.send_message(user_message)
        response = await self._handle_tool_loop(chat, response)
        
        # Store agent response
        supabase.table("thread_messages").insert({
            "entry_id": entry_id,
            "role": "assistant",
            "content": response.text,
        }).execute()
        
        # Check if entry was resolved (agent called resolve_entry)
        entry = supabase.table("entries").select("*").eq("id", entry_id).single().execute()
        
        return {
            "entry_id": entry_id,
            "agent_response": response.text,
            "status": entry.data["status"],
            "ctas_level": entry.data.get("ctas_level"),
            "assessment": entry.data.get("assessment"),
        }
    
    async def _handle_tool_loop(self, chat, response):
        """Execute function calls in a loop until the agent gives a text response."""
        while response.candidates[0].content.parts:
            fn_calls = [p for p in response.candidates[0].content.parts if p.function_call]
            if not fn_calls:
                break
            
            fn_responses = []
            for part in fn_calls:
                result = await self._execute_tool(part.function_call.name, dict(part.function_call.args))
                fn_responses.append(
                    genai.protos.Part(function_response=genai.protos.FunctionResponse(
                        name=part.function_call.name,
                        response={"result": result},
                    ))
                )
            response = chat.send_message(fn_responses)
        return response
    
    async def _execute_tool(self, name: str, args: dict) -> str:
        if name == "extract_symptoms":
            for symptom in args["symptoms"]:
                supabase.table("symptoms").insert({
                    "entry_id": self.current_entry_id,
                    "user_id": self.user_id,
                    "name": symptom["name"],
                    "severity": symptom.get("severity"),
                    "duration": symptom.get("duration"),
                    "body_area": symptom.get("body_area"),
                }).execute()
            return json.dumps({"extracted": len(args["symptoms"])})
        
        elif name == "get_recent_entries":
            days = args.get("days_back", 30)
            since = (datetime.now() - timedelta(days=days)).isoformat()
            result = (
                supabase.table("entries")
                .select("*, symptoms(*)")
                .eq("user_id", self.user_id)
                .neq("id", self.current_entry_id)
                .gte("created_at", since)
                .order("created_at", desc=True)
                .execute()
            )
            return json.dumps(result.data)
        
        elif name == "assess_triage":
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    TRIAGE_ENDPOINT,
                    json={"presentation": args["structured_presentation"]},
                    timeout=30,
                )
                return resp.text
        
        elif name == "find_care_options":
            care_type = args["care_type"]
            result = supabase.table("clinics").select("*").eq("type", care_type).execute()
            return json.dumps(result.data[:5])
        
        elif name == "link_to_entry":
            supabase.table("entries").update({
                "linked_entry_id": args["previous_entry_id"],
                "link_reason": args["reason"],
            }).eq("id", self.current_entry_id).execute()
            return json.dumps({"linked": True})
        
        elif name == "resolve_entry":
            supabase.table("entries").update({
                "status": args["status"],
                "ctas_level": args["ctas_level"],
                "ctas_label": args["ctas_label"],
                "assessment": args["assessment"],
                "recommended_action": args["recommended_action"],
                "resolved_at": datetime.now().isoformat(),
            }).eq("id", self.current_entry_id).execute()
            return json.dumps({"resolved": True})
        
        elif name == "generate_overview":
            supabase.table("overview_snapshots").insert({
                "user_id": self.user_id,
                "status_summary": args["status_summary"],
                "pattern_alerts": args.get("pattern_alerts", []),
            }).execute()
            return json.dumps({"overview_updated": True})
        
        return json.dumps({"error": "unknown tool"})
```

### The Entry Processing Pipeline

When a user submits a new entry, here's exactly what happens:

```
User submits: "really tired, hair falling out, skin is dry"
                    │
                    ▼
1. Entry created in DB (status: active)
                    │
                    ▼
2. Agent calls extract_symptoms
   → [Fatigue · chronic] [Hair loss] [Dry skin]
   → Saved to symptoms table, linked to entry
                    │
                    ▼
3. Agent calls get_recent_entries (last 30 days)
   → Finds: "persistent fatigue, cold intolerance" from 3 days ago
                    │
                    ▼
4. Agent calls link_to_entry
   → Links current entry to the fatigue entry
                    │
                    ▼
5. Agent asks follow-up questions:
   "I see you reported fatigue and cold intolerance 3 days ago.
    Has that improved? Any weight changes? Menstrual changes?"
                    │
                    ▼
6. User responds: "no still tired, gained 5 lbs, no diet changes"
                    │
                    ▼
7. Agent calls assess_triage with structured presentation:
   "28F, persistent fatigue x2 weeks, cold intolerance, new onset
    hair loss, dry skin, unexplained weight gain +5 lbs. No fever,
    no acute distress."
                    │
                    ▼
8. Fine-tuned model returns: CTAS 4 · Less Urgent
   "Recommend GP visit within 1 week. Thyroid panel indicated."
                    │
                    ▼
9. Agent calls resolve_entry:
   CTAS 4, "Symptom cluster warrants thyroid evaluation",
   "See GP within 1 week for blood work (TSH, T3, T4)", status: watching
                    │
                    ▼
10. Agent calls generate_overview:
    Updates health snapshot with new pattern alert
                    │
                    ▼
11. Entry card in feed now shows:
    - CTAS 4 badge
    - Extracted symptom tags
    - Link to previous entry
    - Assessment + recommended action
    - [Find care near me →] button
```

### The Input Translation Layer

The fine-tuned triage model expects structured clinical input. Users type casually. Gemini bridges this gap:

**User typed:** "really tired, hair falling out, skin is dry"

**Gemini translates to (inside assess_triage):** "28-year-old female presenting with persistent fatigue for approximately 2 weeks despite adequate sleep, new onset increased hair shedding, generalized dry skin, cold intolerance (reported 3 days prior, ongoing), and unexplained weight gain of 5 lbs. No fever, no acute symptoms. No significant past medical history."

**Fine-tuned model receives** the structured version and returns a CTAS assessment.

---

## DATABASE SCHEMA (Supabase)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    location_lat FLOAT,
    location_lng FLOAT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- The primary entity. Each time the user logs something, it's an entry.
CREATE TABLE entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    raw_text TEXT NOT NULL,              -- what the user typed verbatim
    photo_url TEXT,                      -- optional photo attachment
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'watching', 'escalated')),
    ctas_level INT CHECK (ctas_level BETWEEN 1 AND 5),  -- fine-tuned model output
    ctas_label TEXT,                     -- "Resuscitation" / "Emergent" / "Urgent" / "Less Urgent" / "Non-Urgent"
    assessment TEXT,                     -- agent-generated assessment summary (1-2 sentences)
    recommended_action TEXT,             -- "See GP within 1 week" / "ER within 2 hours" etc.
    linked_entry_id UUID REFERENCES entries(id),  -- links to a related previous entry
    link_reason TEXT,                    -- why it's linked: "same symptom cluster" / "follow-up"
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- Extracted symptoms — each entry can have multiple
CREATE TABLE symptoms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    name TEXT NOT NULL,                  -- "Headache", "Fatigue", "Nausea"
    severity TEXT,                       -- "mild" / "moderate" / "severe"
    duration TEXT,                       -- "3 days", "since this morning"
    body_area TEXT,                      -- "temples", "lower back", "left arm"
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Thread messages within an entry (the follow-up Q&A)
CREATE TABLE thread_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Treatments (logged after doctor visits)
CREATE TABLE treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    entry_id UUID REFERENCES entries(id),  -- which entry triggered this visit
    medication TEXT,
    duration_days INT,
    start_date DATE DEFAULT CURRENT_DATE,
    follow_up_action TEXT,
    follow_up_deadline DATE,
    follow_up_completed BOOLEAN DEFAULT false,
    referral_specialist TEXT,
    referral_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Clinic data (scraped)
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('er', 'urgent_care', 'walk_in', 'after_hours', 'telehealth')),
    address TEXT,
    latitude FLOAT,
    longitude FLOAT,
    phone TEXT,
    hours JSONB,
    services JSONB,                      -- ["General", "Blood work", "Mental health"]
    current_wait_minutes INT,
    source TEXT,
    last_updated TIMESTAMPTZ
);

-- Overview snapshots (regenerated after each entry resolves)
CREATE TABLE overview_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    status_summary TEXT,                 -- "3 entries in past 2 weeks, 1 active concern..."
    pattern_alerts JSONB,               -- [{message: "...", severity: "warning", entry_ids: [...]}]
    generated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## DEMO SCRIPT (3-4 minutes)

**Pre-populate entry cards showing a 2-week timeline. The demo walks through the cards, then does ONE live entry.**

### Scene 1: Show the feed (30s)
Open Medunity. The feed shows 3 pre-populated entry cards from the past 2 weeks. Point out the structure: each card has the user's original text, extracted symptom tags, CTAS badge, and assessment. "This is not a chatbot. Each card is a health moment the user logged. The system extracted symptoms, scored urgency, and generated an assessment."

### Scene 2: Walk through the linked entries (30s)
Click into the second card (fatigue + hair loss + dry skin from Thursday). Show the CTAS 4 badge, the extracted symptoms, and critically — the link to the earlier fatigue entry from Monday. "The system connected these entries automatically. The user didn't know their hair loss was related to their fatigue. Medunity did." Expand the thread to briefly show the follow-up questions.

### Scene 3: Live entry — THE MONEY SHOT (60s)
Type a new entry live: "I've been having chest tightness and my left arm feels kind of numb"

Show the system in real-time:
1. Symptom tags appear: [Chest tightness] [Left arm numbness]
2. Agent asks: "How long has this been going on? Any shortness of breath? Any sweating or nausea? Is the numbness constant or does it come and go?"
3. Answer: "started about an hour ago, yeah a bit short of breath, no sweating"
4. CTAS badge appears: **CTAS 2 · Emergent** (RED)
5. Assessment: "Chest tightness with left arm numbness and shortness of breath requires immediate evaluation."
6. Recommended action: **"Go to the ER now."**
7. Care routing panel slides up automatically — shows nearest ERs with LIVE wait times, sorted by distance

This is the moment. The system didn't just say "consult a doctor." It scored the urgency accurately, told the user exactly where to go, and showed real wait times. That's the product.

### Scene 4: Care routing detail (30s)
Walk through the care routing panel. "These are real Ontario ER wait times scraped every 15 minutes. The system matched the triage level to the right care type — for CTAS 2 it's showing ERs only, not walk-ins. It shows which one is closest, which has the shortest wait, and which ones have cardiac services." Highlight that the previous CTAS 4 entry showed walk-ins and GPs, not ERs. The routing adapts to urgency.

### Scene 5: Overview panel (30s)
Switch to the overview. Show: entry history with CTAS badges trending over time, symptom frequency chart, the pattern alert about fatigue cluster, treatment tracker. "The overview connects everything. It shows patterns the user wouldn't see, tracks treatments they'd forget about, and gives them and their eventual doctor a complete picture."

### Scene 6: Architecture + impact (30s)
Quick slide. "Fine-tuned Qwen3-8B on 2,000+ CTAS-grounded triage cases using QLoRA on Modal. The fine-tuned model does the urgency scoring. Gemini orchestrates — extracting symptoms, connecting entries, translating casual language into structured clinical input. Real-time clinic data via Modal fan-out scraping."

Close: "6.5 million Canadians don't have a family doctor. When something's wrong, they Google it and panic, or ignore it. Medunity gives them what a family doctor provides: someone tracking their health over time, assessing urgency accurately, and telling them exactly where to go when they need care."

---

## TIMELINE

### BEFORE THE HACKATHON (start now)

- [ ] Download CTAS PDFs (both the Participant Manual and Ontario Paramedic Guide)
- [ ] Read through them enough to understand the 5 levels, modifier system, and complaint categories
- [ ] Set up Modal account, test GPU access (`modal run hello_world.py`)
- [ ] Set up Supabase project, create all tables from schema above
- [ ] Get Gemini API key (Google AI Studio)
- [ ] Manually inspect er-watch.ca and medimap.ca HTML — figure out CSS selectors for scraping
- [ ] Set up Next.js project skeleton with a basic chat UI
- [ ] Generate training data: run the synthetic generation prompt ~40 times with Claude → ~2,000 examples
- [ ] Clean and validate the training data (check distribution, remove malformed)
- [ ] Upload training data to Modal volume

### FRIDAY NIGHT (4 hours)

- [ ] Run fine-tuning on Modal (~30-60 min)
- [ ] While training: build clinic scraping functions, test them
- [ ] While training: wire up FastAPI backend with Supabase
- [ ] Training done → deploy model serving endpoint on Modal
- [ ] Test: `curl` the triage endpoint with sample presentations
- [ ] Run clinic scraper, cache results in Supabase
- [ ] **Checkpoint: triage model serving + clinic data in DB**

### SATURDAY MORNING (4 hours)

- [ ] Build the Gemini orchestration agent with function calling
- [ ] Implement all 7 tools: extract_symptoms, get_recent_entries, assess_triage, find_care_options, link_to_entry, resolve_entry, generate_overview
- [ ] Build the entry processing pipeline: new entry → extract → check history → link → follow-up → triage → resolve → update overview
- [ ] Test end-to-end: submit entry → agent extracts symptoms → calls triage → returns CTAS score + assessment
- [ ] **Checkpoint: full agentic pipeline working in terminal**

### SATURDAY AFTERNOON (4 hours)

- [ ] Build the frontend entry cards, feed layout, overview panel
- [ ] Add photo upload support
- [ ] Add care routing slide-up panel
- [ ] Build the overview: entry history with CTAS badges, symptom frequency, pattern alerts, treatment tracker
- [ ] Connect frontend → FastAPI → agent → Modal

### SATURDAY NIGHT (3 hours)

- [ ] Pre-populate demo data (entry cards for the 2-week timeline + one treatment)
- [ ] Polish the care routing panel
- [ ] Full end-to-end testing through the UI
- [ ] Test the live entry flow for the demo (chest tightness scenario)
- [ ] **Checkpoint: demo-able product**

### SUNDAY MORNING (3 hours)

- [ ] Build 1-2 architecture slides
- [ ] Polish UI details
- [ ] Rehearse the demo 3+ times
- [ ] Edge case testing — what if triage model gives weird output? (Fallback: Gemini does the triage)
- [ ] Record a backup video demo

### SUNDAY AFTERNOON

- [ ] Final rehearsal
- [ ] Submit + demo

---

## RISKS & MITIGATIONS

| Risk | Mitigation |
|------|-----------|
| Synthetic training data not good enough | Test the fine-tuned model against 20+ known triage cases from the CTAS manual. If it's not better than base Qwen3-8B with prompting, pivot: use the base model with a detailed CTAS prompt instead. The rest of the system still works. |
| Clinic scraping breaks | Pre-cache data. Have a manually-built fallback JSON with ~30 real clinics/ERs in KW/GTA area. |
| Fine-tuned model too slow | vLLM on Modal A100 should be <2s. If cold start is an issue, hit the endpoint once before the demo to warm it up. |
| Gemini function calling is flaky | Test thoroughly. Have fallback: if function calling fails, the agent can still respond conversationally and you manually trigger the triage/routing. |
| Demo breaks live | Have the pre-populated conversation ready to show. Record a backup video. |

---

## WHAT THIS IS NOT (for your pitch)

- Not a diagnosis tool — tracks symptom trajectories and recognizes concerning patterns
- Not a replacement for doctors — gets you to the right doctor faster and keeps you on track after
- Not a reminder app — understands medical context, not just calendar dates
- Not a chatbot with a medical prompt — a longitudinal health agent with a specialized fine-tuned triage model and real-time care routing

---

## KEY PITCH POINTS

1. **"General LLMs hedge on medical urgency — 'please consult a doctor.' Our model, trained on 2,000+ CTAS-grounded triage cases, is decisive like an ER triage nurse."**

2. **"We use two models for two different jobs: a specialized fine-tuned model for triage (where precision matters) and a frontier model for orchestration (where broad reasoning matters). This is a deliberate architectural choice."**

3. **"The input translation layer is key. Users say 'my knee's been weird.' Our orchestration agent translates that into a structured clinical presentation before the triage model sees it. Each model gets input in the format it was trained on."**

4. **"We don't just tell you something's wrong. We tell you where to go right now, with live wait times. That's the difference between a health app and a health agent."**

5. **"We called it Medunity because healthcare is fragmented. Every app treats every interaction as independent. Medunity brings unity to your health — tracking your trajectory over weeks, connecting symptoms you'd forget about, and making sure nothing falls through the cracks. That's what 6.5 million Canadians without a family doctor are missing."**