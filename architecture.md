# MedUnity — Architecture

A longitudinal health agent for Canadians. Symptom tracking with AI triage, CTAS-based clinical assessment, real-time facility routing, and provider intake reports.

Built for GenAI Genesis 2026.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 |
| Backend | FastAPI (Python) |
| Database | Supabase (PostgreSQL) |
| AI — Primary | Google Gemini 2.5 Flash (symptom extraction, assessment generation) |
| AI — CTAS | Fine-tuned Gemini 2.5 Flash on Vertex AI (triage classification, with base Gemini fallback) |
| AI — Demand | Railtracks agentic framework + Gemini 2.5 Flash (provider-side demand analysis) |
| Maps | Mapbox GL JS (rendering) + Overpass API (patient facility discovery) |
| Auth | Supabase Auth (Google OAuth) |
| Geocoding | Mapbox Geocoding API |

---

## Project Structure

```
medunity/
├── backend/
│   ├── main.py                         # FastAPI app, CORS, router registration
│   ├── requirements.txt                # Python deps
│   ├── .env                            # Secrets (Supabase, Gemini, Vertex, Mapbox)
│   ├── api/
│   │   ├── entries.py                  # CRUD + triage resolution endpoints
│   │   ├── overview.py                 # 30-day health stats + pattern detection
│   │   ├── clinics.py                  # CTAS-based care routing (Supabase clinics)
│   │   ├── locations.py                # Facility search, anonymous reports
│   │   ├── provider.py                 # Provider: send-report, signals, demand analysis
│   │   └── deps.py                     # Auth dependency (JWT → user_id)
│   ├── agent/
│   │   ├── processor.py                # Gemini: symptom extraction + structured assessment
│   │   ├── triage.py                   # CTAS assessment (Vertex fine-tuned + Gemini fallback)
│   │   └── demand.py                   # Railtracks: ER demand analysis agent (5 tool nodes)
│   ├── models/
│   │   └── schemas.py                  # Pydantic request models
│   ├── services/
│   │   └── supabase.py                 # Singleton Supabase client
│   └── scripts/
│       └── setup_db.sql                # Full schema + seed data
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                  # Root: fonts (DM Sans + Plus Jakarta Sans), AuthProvider
│   │   ├── page.tsx                    # Landing page (sign-in, feature showcase)
│   │   ├── globals.css                 # Design system tokens, Tailwind v4 config
│   │   ├── (app)/                      # Protected routes (require auth)
│   │   │   ├── layout.tsx              # App shell: Sidebar + MobileNav
│   │   │   ├── dashboard/page.tsx      # Health feed + overview panels
│   │   │   ├── locations/page.tsx      # Facility map + staging mode
│   │   │   └── my-data/page.tsx        # Data export (stub)
│   │   └── (provider)/                 # Provider view (separate layout, no sidebar)
│   │       └── provider/page.tsx       # Real signals + simulation, demand analysis
│   │
│   ├── components/
│   │   ├── ui/                         # Atomic design system
│   │   │   ├── Card.tsx                # Rounded container, shadow, hoverable
│   │   │   ├── Button.tsx              # primary / secondary / danger / ghost
│   │   │   ├── Badge.tsx               # Colored pill labels
│   │   │   ├── CTASBadge.tsx           # CTAS level display (1-5, color-coded)
│   │   │   ├── StatusPill.tsx          # Entry status indicator
│   │   │   ├── SymptomTag.tsx          # Symptom with category color
│   │   │   ├── IconCircle.tsx          # Icon in tinted circle
│   │   │   ├── Input.tsx               # Text input
│   │   │   └── Avatar.tsx              # User avatar
│   │   │
│   │   ├── feed/                       # Entry creation & display
│   │   │   ├── EntryBar.tsx            # Input textarea + quick-tap symptom pills
│   │   │   └── EntryCard.tsx           # Full entry: text, symptoms, triage form,
│   │   │                               #   TriageReportCard, thread, actions
│   │   │
│   │   ├── overview/                   # Dashboard stat panels
│   │   │   ├── HealthStatus.tsx        # Entry count + avg CTAS
│   │   │   ├── HealthSummary.tsx       # AI-generated text summary
│   │   │   ├── EntryHistory.tsx        # Recent entries list
│   │   │   ├── SymptomFrequency.tsx    # Top symptoms bar chart
│   │   │   ├── PatternAlert.tsx        # Recurring symptom warning
│   │   │   └── TreatmentTracker.tsx    # Treatment progress (demo)
│   │   │
│   │   ├── triage/                     # Triage assessment display
│   │   │   └── TriageReportCard.tsx    # Structured report: summary, assessment,
│   │   │                               #   recommendation, watch-for, symptoms
│   │   │
│   │   ├── locations/                  # Facility discovery & care routing
│   │   │   ├── LocationsPage.tsx       # Main container: map + panels + staging mode
│   │   │   ├── MapView.tsx             # Mapbox GL integration
│   │   │   ├── FacilityCard.tsx        # Facility detail: wait, distance, services,
│   │   │   │                           #   resources, reports, donation alerts
│   │   │   ├── StagingPanel.tsx        # Top pill bar: entry ID, CTAS, departure picker
│   │   │   ├── StagingFacilityCard.tsx # Facility card with ETA timing + Send Report
│   │   │   ├── ProviderReport.tsx      # Full intake document modal (sent to facility)
│   │   │   ├── ResourceList.tsx        # Community centre resource display
│   │   │   └── ReportModal.tsx         # Anonymous facility feedback form
│   │   │
│   │   ├── provider/                   # Provider dashboard (real + simulation)
│   │   │   ├── ProviderMap.tsx         # Mapbox: single facility pin, signal dots, ETA lines
│   │   │   ├── DemandPanel.tsx         # AI summary, cluster alerts, capacity, queue,
│   │   │   │                           #   diversions, CTAS breakdown, symptoms, nearby
│   │   │   └── SimulationBar.tsx       # Scenario picker + live toggle + real/sim counts
│   │   │
│   │   └── layout/                     # Navigation
│   │       ├── Sidebar.tsx             # Desktop left nav (hover-expand, icon+label)
│   │       └── MobileNav.tsx           # Mobile bottom tab bar
│   │
│   ├── lib/
│   │   ├── types.ts                    # All TypeScript interfaces + CTAS_FACILITY_MAP
│   │   ├── api.ts                      # Fetch wrapper + all API functions
│   │   ├── auth.tsx                    # AuthContext, useAuth hook, Google OAuth
│   │   ├── supabase.ts                 # Supabase browser client init
│   │   ├── overpass.ts                 # Overpass API queries + Mapbox geocoding
│   │   ├── provider-types.ts           # TriageSignal, ProviderSignal, DemandAnalysis,
│   │   │                              #   CuratedFacility, TORONTO_HOSPITALS
│   │   ├── simulation.ts              # Signal generation using curated Toronto hospitals
│   │   ├── demo-data.ts               # Sample entries, treatments, patterns
│   │   └── locations-data.ts           # Static facility seed data (legacy)
│   │
│   ├── package.json
│   ├── tsconfig.json                   # Strict mode, @/* path alias
│   └── next.config.ts                  # React Compiler enabled
│
├── modal/                              # Modal serverless (fine-tuning scripts)
├── data/                               # Training data
├── ctas_eval_vertex.jsonl              # CTAS evaluation dataset
└── ctas_guide_2025.pdf                 # Official CTAS guidelines
```

---

## Database Schema

Eight tables, all with RLS disabled (hackathon mode).

### `entries`
The core table. One row per health log.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | auto-generated |
| `user_id` | TEXT | from Supabase Auth JWT |
| `raw_text` | TEXT | user's original symptom description |
| `photo_url` | TEXT | optional image attachment |
| `extracted_symptoms` | JSONB | `[{label, category}]` — AI-extracted |
| `ctas_level` | INT | 1-5, set on resolution |
| `ctas_label` | TEXT | e.g. "Less Urgent" |
| `status` | TEXT | `active` → `resolved` |
| `assessment` | TEXT | clinical summary text |
| `recommended_action` | TEXT | e.g. "See GP within 1 week" |
| `triage_report` | JSONB | full structured report (summary, watch_for, facility types, etc.) |
| `linked_entry_id` | UUID FK→entries | cross-reference to related entry |
| `link_reason` | TEXT | why entries are linked |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `thread_messages`
Conversation thread per entry (triage Q&A, follow-ups).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `entry_id` | UUID FK→entries | CASCADE delete |
| `role` | TEXT | `user` or `assistant` |
| `text` | TEXT | message content |
| `created_at` | TIMESTAMPTZ | |

### `clinics`
Seeded medical facilities (9 KW-area clinics).

| Column | Type |
|--------|------|
| `id` | UUID PK |
| `name`, `type`, `address`, `hours` | TEXT |
| `wait_minutes` | INT |
| `latitude`, `longitude` | DOUBLE PRECISION |
| `is_open` | BOOLEAN |
| `closing_time` | TEXT |
| `services` | JSONB |

### `community_centres`
Seeded community/wellness facilities (7 KW-area centres).

Same structure as clinics plus `is_free` (BOOLEAN) and `phone` (TEXT).

### `centre_resources`
Resources available at community centres (food, clothing, hygiene, etc.).

| Column | Type |
|--------|------|
| `id` | UUID PK |
| `centre_id` | UUID FK→community_centres |
| `name`, `category` | TEXT |
| `in_stock`, `donation_needed` | BOOLEAN |

### `location_reports`
Anonymous facility feedback from visitors or staff.

| Column | Type |
|--------|------|
| `id` | UUID PK |
| `facility_id` | TEXT |
| `reporter_type` | TEXT (`visitor` / `medical-professional`) |
| `message` | TEXT |
| `wait_time_update` | INT |
| `strain_level` | TEXT (`low` / `moderate` / `high` / `critical`) |

### `provider_signals`
Incoming patient signals sent from the patient side to provider facilities.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | auto-generated |
| `entry_id` | UUID FK→entries | nullable, links to patient entry |
| `facility_id` | TEXT | curated hospital ID (e.g. `toronto-general`) |
| `facility_name` | TEXT | |
| `ctas_level` | INT | 1-5 |
| `chief_complaint` | TEXT | |
| `symptoms` | JSONB | `["chest pain", "sweating"]` |
| `eta_minutes` | INT | estimated arrival time |
| `latitude`, `longitude` | DOUBLE PRECISION | patient location |
| `suggested_ward` | TEXT | computed by `suggest_ward()` on insert |
| `prep_checklist` | JSONB | computed by `generate_prep_checklist()` |
| `status` | TEXT | `active` (default) |
| `reported_at` | TIMESTAMPTZ | |

---

## API Endpoints

All protected endpoints extract `user_id` from the Supabase JWT in the `Authorization: Bearer` header.

### Entries

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/entries` | Create entry → AI extracts symptoms, generates triage questions |
| `POST` | `/api/entries/{id}/respond` | Add message or resolve → triggers full CTAS assessment |
| `GET` | `/api/entries` | List all user entries (30-day, desc) with thread messages |
| `GET` | `/api/entries/{id}` | Get single entry with thread |
| `DELETE` | `/api/entries/{id}` | Delete entry (cascades thread_messages) |

### Overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/overview` | 30-day stats: entry count, avg CTAS, symptom frequency, pattern alerts |

### Clinics

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/clinics/route` | CTAS-based routing from seeded clinics (top 5 by wait time) |

### Locations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/locations/facilities` | Search clinics + centres by type and coordinates |
| `POST` | `/api/locations/reports` | Anonymous facility report (no auth required) |

### Provider

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/provider/send-report` | Patient sends triage report → creates provider signal with ward + checklist |
| `GET` | `/api/provider/{facility_id}/signals` | Active signals for a facility (polled every 10s) |
| `POST` | `/api/provider/analyze` | Run Railtracks demand analysis → AI summary, clusters, capacity, diversions |

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check |

---

## AI Agent System

### Two-Phase Processing

**Phase 1: `process_new_entry()`** — On entry creation

Uses Gemini 2.5 Flash to analyze the user's raw text + their recent 30-day history.

Returns:
- `extracted_symptoms` — structured array with labels and categories
- `linked_entry_id` + `link_reason` — if this relates to a prior entry
- `triage_questions` — 4-6 structured form questions (yesno, scale 1-10, choice, multiselect, text)
- `immediate_ctas_estimate` — preliminary CTAS level
- `needs_followup` — if false (CTAS 1-2), auto-resolves immediately

**Phase 2: `resolve_entry()`** — After user answers triage form

Two-step:

1. **CTAS Assessment** via `assess_ctas()`:
   - Primary: fine-tuned Gemini 2.5 Flash on Vertex AI (trained on 1,000 CTAS 2025 examples)
   - Fallback: base Gemini 2.5 Flash with CTAS prompt
   - Returns: `ctas_level` (1-5), `ctas_label`, `reasoning`

2. **Structured Report** via Gemini 2.5 Flash:
   - Input: original complaint + extracted symptoms + full triage thread + CTAS result
   - Output (stored as `triage_report` JSONB):

```json
{
  "summary": "One-sentence presentation summary",
  "symptoms_identified": ["Headache", "Photophobia"],
  "assessment": "2-3 sentence clinical assessment",
  "recommended_action": "See GP within 1 week for migraine management",
  "watch_for": ["Vision changes", "Sudden severity increase"],
  "urgency_timeframe": "Within 1 week",
  "recommended_care_type": "walk-in",
  "recommended_facility_types": ["walk-in", "urgent-care"],
  "facility_search_terms": ["migraine", "neurology", "blood work"],
  "facility_exclude_keywords": ["pediatric", "children", "cancer", "addiction"]
}
```

### CTAS Levels

| Level | Label | Example | Auto-resolve? |
|-------|-------|---------|---------------|
| 1 | Resuscitation | Cardiac arrest, severe trauma | Yes (skip triage form) |
| 2 | Emergent | Chest pain, stroke symptoms | Yes (skip triage form) |
| 3 | Urgent | High fever, moderate pain, asthma | No |
| 4 | Less Urgent | Mild pain, ear infection | No |
| 5 | Non-Urgent | Minor cold, prescription renewal | No |

### Phase 3: Demand Analysis (Provider Side) — Railtracks

A separate AI pipeline for the provider view. Uses Railtracks (hackathon sponsor) as the agentic framework with Gemini 2.5 Flash. **Does not touch patient triage — the fine-tuned CTAS model is completely independent.**

The agent has 5 deterministic tool nodes (no LLM calls for tools — only for the final summary):

| Tool | Purpose |
|------|---------|
| `suggest_ward` | Routes patient to ward by CTAS level + symptom category |
| `generate_prep_checklist` | Prep actions (crash cart, ECG, isolation, etc.) |
| `detect_clusters` | Flags 3+ same-category patients → protocol alerts |
| `project_capacity` | Minutes until facility hits capacity |
| `recommend_diversions` | Suggests diverting CTAS 4-5 to less-loaded facilities |

The Railtracks agent synthesizes tool outputs into a natural language summary for the charge nurse. Falls back to deterministic summary if the agent fails. See `railtracks.md` for full documentation.

---

## Data Flow

### Entry Lifecycle

```
User types symptom text
        │
        ▼
  POST /api/entries
        │
        ├─ Insert raw entry into DB
        ├─ Fetch recent entries (30 days, max 10) for context
        ├─ Gemini: process_new_entry()
        │   ├─ Extract symptoms with categories
        │   ├─ Detect links to previous entries
        │   ├─ Generate triage questions
        │   └─ Estimate CTAS
        │
        ├─ If CTAS 1-2: auto-resolve (skip to step below)
        │
        ▼
  Frontend shows EntryCard with triage form
        │
  User answers triage questions
        │
        ▼
  POST /api/entries/{id}/respond  (resolve=true)
        │
        ├─ Store triage answers as thread message
        ├─ assess_ctas() → Vertex fine-tuned model (or Gemini fallback)
        ├─ Gemini: generate structured triage report
        ├─ Store triage_report JSONB + update status to "resolved"
        │
        ▼
  Frontend shows TriageReportCard
        │
  User clicks "Find Care"
        │
        ▼
  Navigate to /locations?entryId=xxx
        │
        ├─ Fetch entry from backend
        ├─ Fetch nearby facilities from Overpass API
        ├─ Filter by AI-recommended facility types + search terms
        │
        ▼
  Staging mode: top pill bar + glass facility panel
        │
  User clicks "Send Report" on a facility
        │
        ▼
  ProviderReport modal: full intake document
        │
  User clicks "Send to Provider"
        │
        ▼
  POST /api/provider/send-report
        │
        ├─ Compute suggested ward + prep checklist (deterministic)
        ├─ Insert into provider_signals table
        │
        ▼
  Confirmation — signal appears in provider view
```

### Overview & Pattern Detection

```
GET /api/overview
    │
    ├─ Fetch all entries (30 days)
    ├─ Count entries, compute avg CTAS
    ├─ Extract all symptoms, count frequency
    ├─ Pattern detection:
    │   IF symptom appears 3+ times:
    │     → Check if present in most recent entry
    │     → Mark trend: "worsening" or "stable"
    │     → Generate alert with GP recommendation
    │
    └─ Return: entryCount, avgCtas, summary, symptomFrequency[], patternAlert
```

### Cross-Entry Context & Linking

The AI agent maintains awareness across entries using a **recent history window**. This enables pattern detection, entry linking, and context-aware triage.

#### How Context is Passed

On every new entry, `process_new_entry()` receives the user's **last 10 entries from the past 30 days** as structured context:

```
Recent health entries from this user:
- [2026-03-14] (id: uuid-abc) "Woke up with a dull headache..." → Symptoms: Headache, Nausea
- [2026-03-14] (id: uuid-def) "The headache is getting worse..." → Symptoms: Headache, Photophobia
```

The AI uses this to:
- Set `linked_entry_id` to the UUID of a related prior entry
- Set `link_reason` explaining the connection (e.g., "Same headache pattern, escalating with new photophobia")
- Generate triage questions informed by what's already been reported (avoids redundant questions)
- Adjust CTAS estimation based on symptom escalation patterns

On resolution, `resolve_entry()` receives the same recent entries plus the full triage thread, so the assessment considers progression across the day.

#### Patient Profile Context

If the user has filled in their health profile (`user_profiles` table), demographics are prepended to both prompts:

```
Patient: 60 year old male, known conditions: Type 2 Diabetes, Hypertension,
current medications: Metformin 500mg, Lisinopril, allergies: Penicillin
```

This means the same chest pain presentation will triage differently for a 60-year-old diabetic (likely CTAS 2) vs. a 20-year-old athlete (likely CTAS 4).

#### Pattern Detection (Backend)

The overview endpoint (`/api/overview`) counts symptom frequency across the 30-day window:
- If any symptom appears **3+ times**, a `patternAlert` is generated
- Trend is marked as `"worsening"` if the symptom appears in the most recent entry, otherwise `"stable"`
- The alert includes `relatedEntryIds` so the user can navigate to the locations page with all related entries bundled

#### AI Health Summary (Cached)

The 30-Day Overview is generated by Gemini using all recent entries + the user profile. It provides a high-level health trajectory commentary (not a repeat of individual entries). The summary is:
- Generated via `regenerate_summary()` in the background after every entry create/resolve/delete
- Cached in `user_profiles.health_summary` so dashboard loads are instant
- Includes profile context (age, conditions, medications) for personalized commentary

#### Known Limitations

| Limitation | Detail |
|-----------|--------|
| **Context window** | Last 10 entries, 30-day lookback. Older entries are invisible to the AI. |
| **No cross-entry triage synthesis** | Each resolution is independent. Entry 4's CTAS assessment doesn't "know" what CTAS levels entries 1-3 received — only their raw text and symptoms. |
| **Fine-tuned CTAS model is stateless** | The Vertex AI CTAS classifier sees only the current presentation. History context is in the Gemini prompt, not the classifier input. |
| **Linking is AI-suggested** | Gemini decides if entries are related based on symptom overlap and temporal proximity. It can miss subtle connections or over-link unrelated entries. |
| **No persistent memory** | Beyond what's in the database (entries, profile, triage reports), the AI has no session memory. Each API call is stateless. |
| **Summary is eventually consistent** | The cached health summary updates asynchronously after entry changes. There's a brief window where the summary reflects the previous state. |

---

## Facility Matching

### Smart Matching (AI-Driven)

When a user navigates to `/locations?entryId=xxx`, facilities are filtered using AI output — not just CTAS level:

```
1. If triage_report.recommendedFacilityTypes exists:
   → Filter facilities by those types
   (e.g., UTI → ["walk-in", "urgent-care"], not "community-centre")

2. Else: fall back to static CTAS_FACILITY_MAP
   CTAS 1   → hospital
   CTAS 2   → hospital, urgent-care
   CTAS 3   → hospital, urgent-care, walk-in
   CTAS 4   → walk-in, urgent-care, community-centre
   CTAS 5   → walk-in, community-centre, wellness-centre, telehealth

3. Additionally match by facilitySearchTerms vs facility.services
   (e.g., "urology" matches a clinic listing "Urology" in services)
```

### Facility Discovery

Facilities come from two sources:

1. **Overpass API** (OpenStreetMap) — real-time query by lat/lng + radius
   - Hospitals, clinics, doctors, community centres
   - Classified into FacilityType by OSM tags
   - Distance calculated via Haversine formula
   - Travel time estimated at 40 km/h
   - Wait times seeded deterministically by facility name

2. **Supabase** (seeded data) — 9 clinics + 7 community centres in KW area
   - Used by `/api/clinics/route` for CTAS-based routing
   - Used by `/api/locations/facilities` for combined results

---

## Auth Flow

```
Landing page → "Sign in with Google" button
    │
    ▼
Supabase Auth → Google OAuth consent
    │
    ▼
Redirect back to /dashboard with session
    │
    ▼
Frontend: supabase.auth.getSession() → access_token
    │
    ▼
All API requests: Authorization: Bearer {access_token}
    │
    ▼
Backend: supabase.auth.get_user(token) → user.id
    │
    ▼
All queries filtered by user_id
```

Protected routes are wrapped in the `(app)` route group, which uses `layout.tsx` to render the Sidebar + MobileNav shell. The `AuthProvider` in the root layout listens to auth state changes and redirects unauthenticated users to the landing page.

---

## Frontend Architecture

### Routing

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `page.tsx` | Landing page, redirect if authed |
| `/dashboard` | `(app)/dashboard/page.tsx` | Health feed + overview |
| `/locations` | `(app)/locations/page.tsx` | Map + facility list, staging mode via `?entryId=` |
| `/my-data` | `(app)/my-data/page.tsx` | Data export (stub) |
| `/provider` | `(provider)/provider/page.tsx` | Provider simulation dashboard |

### Layout Hierarchy

```
RootLayout (fonts, AuthProvider)
├── Landing page (no shell)
├── (app) Layout (Sidebar + MobileNav)
│   ├── Dashboard
│   ├── Locations
│   └── My Data
└── (provider) Layout (separate, no sidebar)
    └── Provider Dashboard
```

### Dashboard Layout

**Desktop**: two-column, fixed height
- Left panel (380px): HealthStatus, PatternAlert, EntryHistory, SymptomFrequency
- Right panel (flex): pinned EntryBar + scrollable entry cards

**Mobile**: tabbed
- Tab 1 "Feed": EntryBar + entries
- Tab 2 "Overview": all stat panels stacked

### Locations Layout

**Normal mode**: full-bleed Mapbox map + floating glass right panel
- Right panel (480px): location search, radius slider, type filters, facility cards
- Glass effect: `backdrop-blur-lg`, semi-transparent surfaces, `border border-white/30`

**Staging mode** (when `?entryId=` present): full-bleed map + floating top pill + floating glass right panel
- Top pill: Entry # + date, CTAS badge, summary, departure time picker, expandable details
- Right panel: "Matching Facilities" header + "View All Facilities" button, AI-filtered StagingFacilityCards

### Provider Dashboard Layout

Full-width, no sidebar. Two-column:
- Left: Mapbox map (single facility pin + CTAS-colored signal dots + ETA lines)
- Right (420px): DemandPanel (AI summary, cluster alerts, capacity, queue with ward + checklists, diversions, CTAS breakdown, timeline, symptoms, nearby facilities)
- Bottom: SimulationBar (scenario picker, generate/live/clear, "X real + Y sim = Z total")

---

## Design System

### Colors

```
Background:    #EEF0F4  (off-white)
Surface:       #FFFFFF  (cards)
Surface-soft:  #F3F4F7  (alt backgrounds)
Border:        #E2E5EB / #ECEEF2

Text-primary:   #0F1729  (headings)
Text-secondary:  #475569  (body)
Text-tertiary:   #94A3B8  (labels, timestamps)

Accent:        #5D9E82  (primary green)
Accent-soft:   #EDF6F2  (green tint bg)
Danger:        #DC2626  (red)
Warning:       #D97706  (amber)
Info:          #0891B2  (cyan)
```

### Typography

- **Headings**: Plus Jakarta Sans (geometric, warm)
- **Body**: DM Sans (clean, readable)

### Spacing Philosophy

- Inside cards: generous (20-24px padding)
- Between cards: tight (4-6px gaps showing page bg through)
- Effect: "packed mosaic" — density outside, breathing room inside

### Component Patterns

- Nested rounded rectangles (`--radius-sm: 8px`, `--radius-md: 12px`, `--radius-lg: 16px`)
- Muted, desaturated palette with accent pops
- Large stat numbers + tiny unit labels
- Icons inside tinted circles
- Pill badges everywhere
- Glass panels on map pages (blur + transparency + white border)

---

## Provider View System

The provider dashboard shows **real patient signals** (from `provider_signals` table) combined with **simulated signals** for demand planning. It uses 7 curated Toronto hospitals instead of Overpass API queries.

### Curated Facilities

| Hospital | ID |
|----------|----|
| CAMH | `camh` |
| Toronto General Hospital | `toronto-general` (default) |
| St. Michael's Hospital | `st-michaels` |
| SickKids Hospital | `sickkids` |
| Mount Sinai Hospital | `mount-sinai` |
| Sunnybrook Health Sciences Centre | `sunnybrook` |
| Toronto Western Hospital | `toronto-western` |

### Signal Sources

1. **Real signals** — Polled every 10s via `GET /api/provider/{facility_id}/signals`. Created when patients send reports from the locations page.
2. **Simulated signals** — Generated client-side via "Generate Demand" button. Added ON TOP of real signals. "Reset" only clears simulated signals.

### Simulation Scenarios

| Scenario | CTAS Distribution | Signal Count |
|----------|------------------|-------------|
| Normal | Weighted toward 4-5 | 35 |
| Flu Season | Heavy 3-4, respiratory clustering | 55 |
| Mass Casualty | Spike in 1-2, injury clustering | 25 |
| Heat Wave | Elevated 3-4, GI/general clustering | 45 |

### Signal Generation

Each `ProviderSignal` includes:
- Geographic coordinates (2-8km radius around target facility for Toronto metro spread)
- CTAS level + symptoms + chief complaint (from 8 symptom clusters)
- Suggested ward assignment (deterministic, mirrors backend `suggest_ward()`)
- ETA in minutes (based on Haversine distance at 35 km/h)

### Demand Analysis

When signals change, a debounced (1.5s) call to `POST /api/provider/analyze` runs the Railtracks demand agent. The DemandPanel shows:
1. **AI Demand Summary** — from Railtracks agent
2. **Cluster Alerts** — protocol activation warnings
3. **Capacity Projection** — minutes until full + recommendations
4. **Incoming Queue** — each patient with CTAS badge, ward pill, expandable prep checklist
5. **Diversion Recommendations** — suggest rerouting low-acuity patients
6. **CTAS Breakdown + Arrival Timeline + Top Symptoms + Nearby Facilities**

### Map

The provider map shows ONLY the selected facility as a single prominent pin. Signal dots are CTAS-colored with ETA lines to the facility. Hover popups show chief complaint, symptoms, suggested ward, and ETA. No cluttered facility markers.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Anon/publishable key |
| `SUPABASE_SERVICE_KEY` | Service role key (bypasses RLS) |
| `GOOGLE_API_KEY` | Gemini API access (triage + processing) |
| `GEMINI_API_KEY` | Railtracks demand agent (same key as GOOGLE_API_KEY) |
| `VERTEX_API_KEY` | Vertex AI (fine-tuned CTAS model) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox (used in backend for geocoding) |

### Frontend (`frontend/.env.local`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL + Geocoding |

---

## Running Locally

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Database Setup

Run `backend/scripts/setup_db.sql` in the Supabase SQL Editor. This creates all tables (including `provider_signals`), indexes, and seeds KW-area clinics and community centres.

To add new tables/columns to an existing database:

```sql
ALTER TABLE entries ADD COLUMN IF NOT EXISTS triage_report JSONB;

-- Provider signals (run if table doesn't exist yet)
CREATE TABLE IF NOT EXISTS provider_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID REFERENCES entries(id),
  facility_id TEXT NOT NULL,
  facility_name TEXT NOT NULL,
  ctas_level INT NOT NULL,
  chief_complaint TEXT NOT NULL,
  symptoms JSONB DEFAULT '[]'::jsonb,
  eta_minutes INT NOT NULL DEFAULT 15,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  suggested_ward TEXT,
  prep_checklist JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  reported_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE provider_signals DISABLE ROW LEVEL SECURITY;
```

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                        │
│  Landing │ Dashboard │ Locations    │ Provider               │
│          │ (feed +   │ (map +       │ (real signals +        │
│          │  overview) │  staging +   │  simulation +          │
│          │           │  send report) │  demand analysis)      │
└───────────────┬──────────────────────┬───────────────────────┘
                │ HTTPS (Bearer JWT)    │ HTTPS (no auth)
                ▼                       ▼
┌──────────────────────────────────────────────────────────────┐
│                     FastAPI Backend                           │
│                                                              │
│  Patient Pipeline            │  Provider Pipeline            │
│  ─────────────────           │  ──────────────────           │
│  /api/entries                │  /api/provider/send-report    │
│  /api/overview               │  /api/provider/{id}/signals   │
│  /api/clinics                │  /api/provider/analyze        │
│  /api/locations              │                               │
│       │                      │       │                       │
│       ▼                      │       ▼                       │
│  ┌─────────────┐             │  ┌──────────────────┐         │
│  │ processor.py │            │  │ demand.py         │         │
│  │ (Gemini)     │            │  │ (Railtracks agent)│         │
│  └──────┬──────┘             │  │ 5 deterministic   │         │
│         │                    │  │ tool nodes +       │         │
│  ┌──────▼──────┐             │  │ Gemini summary    │         │
│  │ triage.py   │             │  └──────────────────┘         │
│  │ Fine-tuned  │             │                               │
│  │ Vertex AI   │             │                               │
│  └─────────────┘             │                               │
└───────┬──────────────────────┴───────┬───────────────────────┘
        │                              │
  ┌─────▼─────┐     ┌─────────────────▼──────────────────┐
  │ Supabase  │     │           Gemini API                │
  │ Postgres  │     │  ┌──────────────┐ ┌──────────────┐  │
  │ + Auth    │     │  │ Base 2.5     │ │ Vertex AI    │  │
  │           │     │  │ Flash        │ │ (fine-tuned  │  │
  │ Tables:   │     │  │ (processing, │ │  CTAS model) │  │
  │ entries   │     │  │  demand      │ │              │  │
  │ threads   │     │  │  summary)    │ │              │  │
  │ clinics   │     │  └──────────────┘ └──────────────┘  │
  │ signals   │     └─────────────────────────────────────┘
  │ ...       │
  └───────────┘     ┌──────────────┐  ┌──────────────┐
                    │ Overpass API │  │ Mapbox       │
                    │ (OSM)        │  │ GL + Geocode │
                    └──────────────┘  └──────────────┘
```
