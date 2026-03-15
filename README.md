# MedUnity

**Longitudinal healthcare to empower and inform Canadians — personally and systemically.**

From CTAS-aligned AI triage, to choosing the right facility, to real-time provider demand intelligence.

Built for GenAI Genesis 2026.

---

## The Problem

6.5 million Canadians don't have a family doctor. When something feels wrong, their options are Google, a chatbot with no clinical training, or a 4-hour ER wait. Patients don't know how serious their symptoms are — so they either waste hours in an ER for a sore throat or ignore something that needs attention. Providers on the other end have no visibility into who's coming, no way to prepare, and no community-wide picture of demand.

## What MedUnity Does

MedUnity creates a shared layer of medical intelligence across patients, providers, and communities.

### For Patients
- **Symptom tracking** — log how you're feeling in plain language. AI extracts structured symptoms, links related entries, and detects patterns over your 30-day health timeline.
- **CTAS triage** — answer a short assessment form and receive a clinical-grade triage report powered by a fine-tuned model trained on Canada's official emergency acuity standard (CTAS 2025).
- **Smart care routing** — get matched to facilities based on your specific condition, not just proximity. Send your triage report ahead so the provider knows you're coming.

### For Providers
- **Real-time demand dashboard** — incoming patient signals on a live map, driving along actual road routes toward your facility.
- **AI demand analysis** — cluster detection ("4 respiratory patients incoming — consider isolation protocol"), capacity projection, ward assignments, prep checklists, diversion recommendations.
- **Scenario simulation** — stress-test readiness with flu season, mass casualty, and heat wave scenarios using curated Toronto patient profiles with time-acceleration.

### For Communities
- **Community health centres** with live resource inventories — naloxone kits, menstrual products, STI testing, mental health counselling slots.
- **Resource shortage reporting** — staff and visitors flag what's running low in real time.

---

## Architecture

```
Patient logs symptoms
    → Gemini extracts structured data + generates triage questions
    → User answers triage form
    → Fine-tuned CTAS model (Vertex AI) assigns acuity level
    → Structured triage report generated
    → Smart facility matching via Overpass API
    → Patient sends intake report to facility
        → provider_signals table
            → Provider dashboard sees incoming signal
            → Railtracks agent runs demand analysis
            → Ward routing, cluster alerts, capacity projection
```

### Two Separate AI Pipelines

| Pipeline | Model | Framework | Purpose |
|----------|-------|-----------|---------|
| Patient triage | Fine-tuned Gemini 2.5 Flash (Vertex AI) | Google GenAI SDK | CTAS classification + clinical reports |
| Provider demand | Base Gemini 2.5 Flash | Railtracks | Demand analysis with 5 tool nodes |

The fine-tuned CTAS model was trained on 1,000 synthetic examples covering all 169 CEDIS complaint categories, Primary Modifiers, and Complaint-Specific Modifiers from the CTAS 2025 guidelines. 80% casual language, 20% clinical. 77% validation accuracy on a 5-class task.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Backend | FastAPI (Python), Uvicorn |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Google OAuth) |
| AI — Triage | Fine-tuned Gemini 2.5 Flash on Google Cloud Vertex AI |
| AI — Demand | Railtracks agentic framework + Gemini 2.5 Flash |
| AI — Processing | Google Gemini 2.5 Flash |
| Maps | Mapbox GL JS, Mapbox Directions API, Mapbox Geocoding API |
| Facility Data | Overpass API (OpenStreetMap) |

---

## Running Locally

### Prerequisites
- Node.js 18+, Python 3.11+
- Supabase project (free tier works)
- Google Cloud account (for Vertex AI fine-tuned model)
- Mapbox account (for maps + directions)

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Copy .env.example to .env and fill in keys
uvicorn backend.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
# Copy .env.local.example to .env.local and fill in keys
npm run dev
```

### Database

Run `backend/scripts/setup_db.sql` in the Supabase SQL Editor for the base schema, then `backend/scripts/migrate_provider_and_centres.sql` for provider signals + Toronto community health centres with resources.

---

## Key Features in Detail

### CTAS Fine-Tuning

The Canadian Triage and Acuity Scale is the standard used in every Canadian ER. Our model is fine-tuned on the 2025 update which introduced:
- Frailty as a universal Primary Modifier
- New modifiers for diplopia, sensory loss, visual disturbances
- Reclassification of sexual assault, head injury, traumatic spine into trauma
- Special population considerations (pediatric, geriatric, immunocompromised)

The model outputs structured text: CTAS level, CEDIS complaint, applied modifiers, and clinical rationale — parsed into a report shareable with providers.

### Simulation Engine

Hand-curated patient profiles pinned to real Toronto neighbourhoods. Each scenario loads clinically realistic presentations:
- **Mass casualty** concentrates trauma at Dundas Square with anxiety/cardiac ripple outward
- **Flu season** spreads respiratory cases city-wide with vulnerable population clusters
- **Heat wave** targets unhoused populations, elderly without A/C, outdoor workers

Signals get road routes from Mapbox Directions API and animate along actual roads. Time acceleration (1x–10x) compresses ETAs so a 25-minute drive plays out in seconds — patients converge on the facility, triggering cluster alerts and capacity warnings as they arrive.

### Railtracks Integration

Five deterministic tool nodes (no LLM latency for critical decisions):
- `suggest_ward` — CTAS level + symptom category → ward (Resus Bay, CCU, Trauma Bay, etc.)
- `generate_prep_checklist` — crash cart, ECG, isolation, splinting based on acuity
- `detect_clusters` — 3+ same-category patients → protocol alert
- `project_capacity` — minutes until full + recommendations
- `recommend_diversions` — reroute CTAS 4-5 to less-loaded facilities

The Railtracks agent synthesizes these into natural language summaries. Deterministic fallback if the agent fails.

---

## Project Structure

```
medunity/
├── backend/
│   ├── agent/
│   │   ├── processor.py        # Gemini: symptom extraction + assessment
│   │   ├── triage.py           # Fine-tuned CTAS model (Vertex AI)
│   │   └── demand.py           # Railtracks demand analysis agent
│   ├── api/
│   │   ├── entries.py          # Patient entry CRUD + triage
│   │   ├── overview.py         # 30-day stats + pattern detection
│   │   ├── locations.py        # Facility search + reports
│   │   ├── provider.py         # Provider signals + demand analysis
│   │   └── profile.py          # User health profile
│   └── scripts/
│       ├── setup_db.sql        # Base schema
│       └── migrate_*.sql       # Provider + community centre migration
│
├── frontend/
│   ├── app/
│   │   ├── (app)/              # Patient views (dashboard, locations, profile)
│   │   └── (provider)/         # Provider demand dashboard
│   ├── components/
│   │   ├── feed/               # Entry input + cards
│   │   ├── overview/           # Health stats, symptoms, patterns
│   │   ├── locations/          # Facility map, staging, reports
│   │   ├── provider/           # Demand panel, simulation, map
│   │   └── ui/                 # Design system atoms
│   └── lib/
│       ├── simulation.ts       # Curated patient profiles + scenarios
│       ├── routes.ts           # Mapbox Directions API
│       └── overpass.ts         # OpenStreetMap facility queries
│
├── data/                       # CTAS training data (1,000 examples)
├── architecture.md             # Full system design
├── ctas_tuning.md              # Fine-tuning documentation
├── railtracks.md               # Demand analysis documentation
└── locations.md                # Facility data + wait time methodology
```

---

## Documentation

| Document | Contents |
|----------|----------|
| [architecture.md](architecture.md) | Full system design, database schema, API endpoints, data flows |
| [ctas_tuning.md](ctas_tuning.md) | Fine-tuning methodology, training data, model metrics, inference |
| [railtracks.md](railtracks.md) | Demand analysis agent, tool nodes, API integration |
| [locations.md](locations.md) | Facility data sources, wait time methodology, resource inventory |

---

## Hackathon Context

**GenAI Genesis 2026** —
Sponsor Tracks: 
Sun Life "Best Health Care Hack Using Agentic AI" track  
Google "Community Impact" track.
Use of Railtracks

MedUnity addresses healthcare fragmentation in Canada where millions navigate a disconnected system without continuity of care. The platform connects patient self-advocacy with provider preparedness and community resource visibility.

**Acuity, Community, Continuity.**
