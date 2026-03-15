# MedUnity

**Longitudinal healthcare to empower and inform Canadians — personally and systemically.**

From CTAS-aligned AI triage, to choosing the right facility, to real-time provider demand intelligence.

Built for GenAI Genesis 2026.

---

## The Problem

Like many university students and young people, I move around all the time — always changing my walk-in clinic, my pharmacy, my context. Often when something feels off, options are Google, a very tempting general-use chatbot that misleads, an 8-hour ER wait only to miss more suitable resources nearby, or even worse — to ignore something that actually needs attention. And that's with having a family doctor — around 6 million Canadians don't.

Most hospitals in Canada are also over 100% capacity, with frontline workers overworked, and overcrowding mismanaged. In 2024, roughly 500,000 Canadians left ERs before seeing a doctor. It reveals a severe systemic weakness in human empowerment that many Canadians know all too well.

**MedUnity exists to empower not only individuals in making the best decisions with their health data, but allowing every user action to inform and benefit the community at large. It's built on 3 areas: acuity, continuity, and community.**

---

## What it does

MedUnity is a **longitudinal health platform** that creates a shared layer of medical intelligence across multiple audiences:

**For patients: an AI-powered preliminary triage system.** You describe symptoms in plain language, answer a dynamically generated short triage form, and receive a structured clinical assessment with a CTAS score and recommendations, all based on CTAS 2025 (the Canadian Triage and Acuity Scale, the same framework used in every Canadian ER). Your entries build a 30-day health timeline, where the agent detects patterns, links related entries, and when you're ready to seek care, routes you to the right facility that matches your condition and optimizes your time. You can send your triage report and ETA ahead so the facility knows you're coming.

**For healthcare providers: real-time demand projections.** Incoming patient signals along with their CTAS score and reports appear on the map, with ETA and location updated live. The system detects clusters ("4 respiratory patients in the last hour, consider isolation protocol"), projects capacity ("full in 45 minutes at current rate"), suggests ward assignments, generates prep checklists, and recommends diversions to less-loaded facilities. Providers can also simulate different scenarios to stress-test readiness.

**For communities:** features under each facility to communicate live updates, wait times, strain and resource shortage. This includes health centres with live resource inventories, where staff can report shortages (naloxone kits running low, menstrual products out of stock) and the community can see what's available where. Hospital staff can report alerts and capacities to advocate for government attention and funding under this network of shared health visibility.

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

---

## How it was built

**CTAS Fine-Tuning:**
Using 1,000 synthetic training examples covering all five CTAS levels, 80% written in casual language, I fine-tuned Gemini 2.5 Flash on Vertex AI and achieved 77% validation accuracy on a 5-class task where most errors are clinically reasonable off-by-one boundary decisions (CTAS 3 vs 2). The model outputs structured assessments: CTAS level, CEDIS complaint, modifiers applied, and clinical rationale — parsed into a structured triage report that both the patient and provider can access.

_About CTAS 2025: has 169 CEDIS complaint categories, Primary Modifiers (airway, breathing, circulation, disability, pain, mechanism of injury, frailty), Complaint-Specific Modifiers, and a 2025 update that reclassified sexual assault into trauma, added frailty as a universal modifier, and introduced new modifiers for diplopia, sensory loss, and pruritus._

**Railtracks:**
The provider side dashboard uses Railtracks to power ER demand intelligence. Five deterministic tool nodes run the analytics — ward routing, prep checklists, cluster detection, capacity projection, diversion recommendations — while a Railtracks agent with Gemini 2.5 Flash synthesizes them into actionable summaries for charge nurses. The tools are fast and deterministic (no LLM latency for critical decisions); the agent adds the narrative layer on top for more accessible insights.

**Other Features:**
- **Triage pipeline**: Gemini extracts symptoms and generates triage questions → user answers → fine-tuned CTAS model classifies → Gemini generates the structured report.
- **Facility discovery**: Overpass API (OpenStreetMap) for real-time hospital/clinic queries, merged with sample data for community health centres that carry resource inventories.
- **Simulation engine**: Four demand scenarios (normal day, flu season, mass casualty, heat wave) with curated Toronto patient profiles, realistic ETAs, deterministic routing table for ward suggestions, time-acceleration controls.

---

## Challenges

- **CTAS boundary ambiguity** was the hardest problem. Solution was to craft training examples where the rationale section explicitly reasons about why a level was chosen, teaching the model to weigh modifiers rather than keyword-match symptoms.
- **Facility matching noise**: querying for nearby facilities returns every eye clinic, chiropractor, and vet office. Built a multi-layer filter: specialist keyword exclusion, AI-recommended facility types from the triage report, with exclusion keywords.
- **Simulation realism**: early versions had patient dots spawning in Lake Ontario with 3-minute ETAs on straight lines. Constrained to Toronto land bounds, used Mapbox Directions for real road geometry, and curated neighbourhood-specific patient profiles with clinically realistic presentations for each scenario.

---

## What I learned

The biggest lesson was that the value isn't limited to the triage for an individual when the problem is systemic. A CTAS level by itself is just a number. But when that number routes you to the right facility, generates a prep checklist for the receiving nurse, feeds into a cluster detection algorithm that triggers an isolation protocol, and shows up on a community resource dashboard — that's when a single patient interaction benefits others in the community.

Simulation wasn't just a demo feature. Running a mass casualty scenario and watching 10 patients converge on Toronto General, triggering cluster alerts and diversion recommendations, revealed bottlenecks in the demand analysis pipeline that I wouldn't have found testing one signal at a time.

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
