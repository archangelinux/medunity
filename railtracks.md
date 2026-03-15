# Railtracks Integration Documentation

## Overview

Medunity uses [Railtracks](https://railtracks.io) (hackathon sponsor's agentic framework) for the **provider-side ER demand analysis** — an AI agent that analyzes incoming patient signals and produces actionable insights for charge nurses.

**Important**: Railtracks is used **only** for demand analysis on the provider view. Patient triage still uses our **fine-tuned Gemini 2.5 Flash model** via Vertex AI (see `ctas_tuning.md`). These are completely separate pipelines.

---

## Architecture

```
Patient Side (unchanged)                    Provider Side (Railtracks)
─────────────────────                       ──────────────────────────
User submits symptoms                       Provider views incoming signals
        ↓                                            ↓
  processor.py (Gemini)                    POST /api/provider/analyze
        ↓                                            ↓
  triage.py (Fine-tuned model)             demand.py — 5 deterministic tools
        ↓                                            ↓
  CTAS level assigned                      Railtracks agent (Gemini 2.5 Flash)
        ↓                                            ↓
  Patient sees result                      AI summary + actionable insights
        ↓
  Send Report → provider_signals table → Provider polls signals
```

---

## What Railtracks Does

The demand analysis agent (`backend/agent/demand.py`) is built as a Railtracks `Flow` with an `agent_node` that has access to 5 `function_node` tools:

### Tool Nodes

| Tool | Function | Description |
|------|----------|-------------|
| `suggest_ward` | Deterministic | Routes patient to ward based on CTAS level + symptom category (Resus Bay, CCU, Trauma Bay, etc.) |
| `generate_prep_checklist` | Deterministic | Generates prep actions (crash cart, ECG, isolation room, etc.) |
| `detect_clusters` | Deterministic | Finds 3+ same-category patients in a time window, triggers protocol alerts |
| `project_capacity` | Deterministic | Estimates minutes until facility hits capacity, recommends actions |
| `recommend_diversions` | Deterministic | Suggests diverting CTAS 4-5 patients to less-loaded nearby facilities |

All 5 tools are **deterministic** (no LLM calls). They run fast and reliably.

The Railtracks agent (Gemini 2.5 Flash) is used **only** to synthesize the outputs of these tools into a concise, actionable natural language summary for the charge nurse. If the agent fails, a deterministic fallback summary is generated from the tool outputs.

### Agent Configuration

```python
demand_agent = rt.agent_node(
    "ER Demand Analyst",
    tool_nodes=[ward, checklist, clusters, capacity, diversions],
    llm=rt.llm.GeminiLLM("gemini-2.5-flash", api_key=gemini_api_key),
    system_message="You are an ER Demand Analyst for a Canadian hospital..."
)

demand_flow = rt.Flow(name="Demand Analysis", entry_point=demand_agent)
```

### Execution

```python
# Deterministic tools run directly (fast path)
ward_suggestions = [suggest_ward(...) for signal in signals]
cluster_alerts = detect_clusters(signals)
capacity_proj = project_capacity(...)
diversions = recommend_diversions(...)

# Railtracks agent generates AI summary (slow path, with fallback)
result = await flow.ainvoke(prompt)
```

---

## API Endpoints

All three endpoints are in `backend/api/provider.py`:

### `POST /api/provider/send-report`
Patient sends a triage report to a facility. Computes ward + checklist deterministically, inserts into `provider_signals` table.

**Request:**
```json
{
  "entry_id": "uuid (optional)",
  "facility_id": "toronto-general",
  "facility_name": "Toronto General Hospital",
  "ctas_level": 2,
  "chief_complaint": "Chest pain with sweating",
  "symptoms": ["chest pain", "sweating", "shortness of breath"],
  "eta_minutes": 15,
  "latitude": 43.65,
  "longitude": -79.39
}
```

**Response:**
```json
{
  "signal": { "id": "uuid", "suggested_ward": "CCU / Monitored Beds", ... },
  "ward": { "ward": "CCU / Monitored Beds", "category": "cardiac" },
  "checklist": { "checklist": ["12-lead ECG on arrival", "Crash cart standby", ...] }
}
```

### `GET /api/provider/{facility_id}/signals`
Returns active signals for a facility. Polled every 10 seconds by the provider frontend.

### `POST /api/provider/analyze`
Runs the full Railtracks demand analysis pipeline.

**Request:**
```json
{
  "signals": [{ "id": "...", "ctas_level": 2, "chief_complaint": "...", "symptoms": [...] }],
  "facility_name": "Toronto General Hospital",
  "facility_load": { "incoming": 15, "capacity": 60, "utilization": 25 },
  "nearby_loads": [{ "name": "Mount Sinai", "utilization": 40, ... }]
}
```

**Response:**
```json
{
  "analysis": {
    "summary": "15 patients incoming. 4 respiratory cases detected — consider isolation protocol...",
    "wardSuggestions": [{ "ward": "CCU / Monitored Beds", "category": "cardiac", "signal_id": "..." }],
    "clusterAlerts": [{ "category": "respiratory", "count": 4, "message": "...", "protocol": "..." }],
    "capacityProjection": { "minutes_until_full": 90, "recommendation": "..." },
    "diversionRecommendations": [{ "facility_name": "Mount Sinai", "recommendation": "..." }],
    "prepChecklists": [{ "checklist": ["12-lead ECG", ...], "signal_id": "..." }]
  }
}
```

---

## Database

### `provider_signals` table (Supabase)

```sql
CREATE TABLE provider_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID REFERENCES entries(id),    -- links to patient entry (nullable)
  facility_id TEXT NOT NULL,               -- curated hospital ID
  facility_name TEXT NOT NULL,
  ctas_level INT NOT NULL,
  chief_complaint TEXT NOT NULL,
  symptoms JSONB DEFAULT '[]'::jsonb,
  eta_minutes INT NOT NULL DEFAULT 15,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  suggested_ward TEXT,                     -- computed by suggest_ward()
  prep_checklist JSONB DEFAULT '[]'::jsonb,-- computed by generate_prep_checklist()
  status TEXT NOT NULL DEFAULT 'active',
  reported_at TIMESTAMPTZ DEFAULT now()
);
```

Run the migration in Supabase SQL Editor from `backend/scripts/setup_db.sql`.

---

## Ward Routing Logic

The `suggest_ward()` function uses a deterministic mapping based on CTAS level and detected symptom category:

| CTAS | Cardiac | Neuro | Respiratory | Mental | Injury | General |
|------|---------|-------|-------------|--------|--------|---------|
| 1 | Resus Bay — Cardiac | Resus Bay — Neuro | Resus Bay — Respiratory | — | Resus Bay — Trauma | Resus Bay |
| 2 | CCU / Monitored Beds | Acute Neuro Bay | Acute Respiratory | Psychiatric Emergency | Trauma Bay | Acute Assessment |
| 3 | Acute Medical | Acute Medical | Respiratory Isolation | Psychiatric Assessment | Acute Medical | Acute Medical |
| 4 | Minor Treatment Area | | | | | |
| 5 | Fast Track / Waiting | | | | | |

Symptom category is detected by mapping individual symptoms to categories (e.g., `chest pain` + `palpitations` -> cardiac) and taking the most frequent.

---

## Cluster Detection

Triggers when 3+ patients in the same symptom category are incoming:

| Category | Protocol |
|----------|----------|
| Respiratory | Consider isolation protocol — possible outbreak |
| Cardiac | Pre-alert cath lab — multiple cardiac presentations |
| Neuro | Stroke code readiness — cluster of neuro presentations |
| Injury | Mass casualty protocol consideration |
| GI | Infection control alert — GI cluster |
| Mental | Crisis team activation — psychiatric surge |

---

## Environment Variables

| Variable | Required | Used By |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | Railtracks agent (Gemini 2.5 Flash) |
| `GOOGLE_API_KEY` | Fallback | If `GEMINI_API_KEY` not set |

Both are set in `backend/.env`. They use the same key value.

---

## Dependencies

```
railtracks>=1.3.1  # in backend/requirements.txt
```

Railtracks pulls in: `litellm`, `openai`, `pydantic-settings`, and other dependencies. Install with:

```bash
cd backend && pip install -r requirements.txt
```

---

## Railtracks Visualizer

To visualize the agent's tool call flow:

```bash
railtracks viz
```

This opens a browser UI showing the flow graph and execution traces when the `/api/provider/analyze` endpoint is called.

---

## Frontend Integration

The provider view (`frontend/app/(provider)/provider/page.tsx`) uses the analysis in these UI sections:

1. **AI Demand Summary** — `demandAnalysis.summary` (from Railtracks agent)
2. **Cluster Alerts** — `demandAnalysis.clusterAlerts` (protocol activation warnings)
3. **Capacity Projection** — `demandAnalysis.capacityProjection` (minutes until full)
4. **Incoming Queue** — each patient shows `suggestedWard` pill + expandable `prepChecklist`
5. **Diversion Recommendations** — `demandAnalysis.diversionRecommendations`

The demand analysis is triggered with a 1.5s debounce whenever signals change, via `POST /api/provider/analyze`.

---

## Relationship to Fine-Tuned CTAS Model

These are **completely separate systems**:

| | Patient Triage | Provider Demand Analysis |
|---|---|---|
| **Model** | Fine-tuned Gemini 2.5 Flash (Vertex AI) | Base Gemini 2.5 Flash (via Railtracks) |
| **File** | `backend/agent/triage.py` | `backend/agent/demand.py` |
| **Purpose** | Assign CTAS level to patient symptoms | Analyze incoming signals for ER readiness |
| **Framework** | Google GenAI SDK | Railtracks |
| **Training** | 1,000 synthetic CTAS examples | None (uses deterministic tools + base model) |
| **Called by** | `processor.py` (patient entry flow) | `provider.py` (provider demand endpoint) |
