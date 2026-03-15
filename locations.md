# Locations & Facility Data

## Data Sources

### Hospitals, Clinics, Urgent Care
- **Source**: Overpass API (OpenStreetMap) — queried in real-time based on user's location + radius
- **File**: `frontend/lib/overpass.ts`
- **What it returns**: Name, type, address, coordinates, hours, services (from OSM tags)
- **Filtering**: Community centres are filtered to only show health-related ones (name/services must contain keywords like "health", "clinic", "harm reduction", etc.)

### Community Health Centres & Wellness Centres
- **Source**: Supabase (seeded via `backend/scripts/migrate_provider_and_centres.sql`)
- **Location**: Toronto — 6 real community health centres with curated resource inventories
- **Merged with Overpass**: The locations page fetches both sources in parallel and deduplicates by name, with Supabase centres taking priority (they have resources)

### Facilities List
| Centre | Type | Address |
|--------|------|---------|
| Parkdale Queen West CHC | community-centre | 1229 Queen St W |
| South Riverdale CHC | community-centre | 955 Queen St E |
| Regent Park CHC | community-centre | 465 Dundas St E |
| Sherbourne Health | wellness-centre | 333 Sherbourne St |
| Unison Health — Jane St | community-centre | 1651 Keele St |
| CAMH — Community | wellness-centre | 60 White Squirrel Way |

---

## Wait Times

**Wait times are NOT real.** There is no public API for Canadian hospital or clinic wait times.

### How they're generated
- Wait times are **seeded pseudo-randomly** from a hash of the facility name
- This makes them deterministic (same facility always shows the same base wait) but fake
- A jitter of +/- 5 minutes is applied every 30 seconds to simulate live updates
- **File**: `frontend/lib/overpass.ts` → `estimateWaitMinutes()`

### Ranges by facility type
| Type | Range | Method |
|------|-------|--------|
| Hospital / ER | 60–240 min | `60 + seededRandom * 180` |
| Walk-in Clinic | 15–75 min | `15 + seededRandom * 60` |
| Urgent Care | 30–90 min | `30 + seededRandom * 60` |
| Community Centre | N/A | No wait time shown |
| Wellness Centre | N/A | No wait time shown |

### Why not real data
- Ontario does not expose a public ER wait time API
- Some provinces (e.g., Alberta) have public dashboards but no API
- Hospital wait times vary by triage level — a single number is misleading
- For a hackathon demo, seeded estimates illustrate the UI concept

### What the UI shows
- Wait time is displayed with a `~` prefix to indicate it's approximate
- The staging card (find care flow) shows "Est. Wait" not "Wait"
- No "estimated seen by" time is shown — adding fake wait + fake travel to get a fake clock time was misleading

---

## Travel Times
- Calculated using **Haversine distance** (straight-line) divided by 40 km/h
- Not real driving directions — just a rough estimate
- The provider view uses **Mapbox Directions API** for actual road routes, but the patient locations page uses the simpler calculation

---

## Resource Inventory
Community health centres have seeded resource lists stored in the `centre_resources` table. Resources include:
- **Harm reduction**: Naloxone kits, fentanyl test strips, sterile needle kits, safer inhalation kits, sharps disposal
- **Sexual health**: Condoms, STI testing kits, pregnancy tests, contraceptives
- **Medical**: Prenatal vitamins, blood glucose monitors, wound care supplies, flu vaccines
- **Hygiene**: Menstrual products, hygiene kits
- **Mental health**: Counselling slots, crisis walk-in sessions, group therapy

Resources can be reported as shortages by visitors or staff via the Submit Report modal.
