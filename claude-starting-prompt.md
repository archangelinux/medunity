Read the file project-plan.md in this repo — it contains the complete technical architecture, database schema, Modal scripts, agent code, and demo plan for Medunity, a longitudinal health agent for Canadians.

Before building any features, set up the project foundation with the design system I'm about to describe. Everything we build should follow this from the start.

## Project Structure

/medunity
├── /frontend          # Next.js 14+ App Router
│   ├── /app
│   ├── /components
│   │   ├── /ui        # Reusable design system components (Button, Card, Input, Badge, StatusPill, etc.)
│   │   ├── /feed      # Entry bar, thread cards, resolved entry cards
│   │   ├── /overview  # Health status, active items, pattern alerts, treatments
│   │   ├── /triage    # Care routing cards, triage results
│   │   └── /layout    # Nav, two-column shell, mobile tabs
│   ├── /lib           # Utils, API client, types
│   └── /public
├── /backend           # FastAPI
│   ├── /api           # Route handlers
│   ├── /agent         # Gemini orchestration agent + function handlers
│   ├── /models        # Pydantic models
│   └── /services      # Supabase client, Modal client, scraping
├── /modal             # Modal scripts (fine-tuning, serving, scraping)
├── /data              # Training data JSONL files
└── project-plan.md

## Design System — "Medunity"

The UI should feel like a premium health companion — clean, soft, trustworthy, modern. Think Apple Health meets a high-end wellness app. NOT clinical or sterile. Warm but precise.

### Color Palette

CSS variables — define these in globals.css:

--color-bg:            #F7F8FA;       /* off-white page background */
--color-surface:       #FFFFFF;       /* card/component background */
--color-surface-soft:  #F0F4F3;      /* subtle alternate surface, sage tint */
--color-border:        #E4E8EC;      /* light borders */
--color-border-soft:   #EEF1F0;      /* very subtle dividers */

--color-text-primary:  #1A1D21;      /* near-black for headings */
--color-text-secondary:#5F6B7A;      /* muted body text */
--color-text-tertiary: #9AA5B4;      /* timestamps, labels */

--color-accent:        #2DB88A;      /* primary green — actions, active states, health-positive */
--color-accent-soft:   #E6F7F0;      /* green tint for backgrounds */
--color-accent-hover:  #25A57A;      /* darker green on hover */

--color-warning:       #F5A623;      /* amber — moderate urgency */
--color-warning-soft:  #FFF7E6;
--color-danger:        #E5544B;      /* red — high urgency, escalation */
--color-danger-soft:   #FEF0EF;
--color-info:          #4A90D9;      /* blue — informational, telehealth */
--color-info-soft:     #EBF3FC;

--color-mint:          #D4F0E7;      /* decorative mint for health-positive elements */
--color-cream:         #FDF9F3;      /* warm cream for special cards */

### Typography

Use Google Fonts. Load these two:

Heading font: "Plus Jakarta Sans" — geometric, modern, slightly rounded, warm but professional
Body font: "DM Sans" — clean, highly readable, pairs perfectly with Plus Jakarta Sans

--font-heading: 'Plus Jakarta Sans', sans-serif;
--font-body: 'DM Sans', sans-serif;

Font sizes (use rem):
- Page title: 1.75rem / 700 weight
- Section heading: 1.25rem / 600 weight  
- Card title: 1rem / 600 weight
- Body: 0.9375rem (15px) / 400 weight
- Small/label: 0.8125rem (13px) / 500 weight
- Tiny/timestamp: 0.75rem (12px) / 400 weight

### Spacing & Radius

IMPORTANT LAYOUT PRINCIPLE: Cards and sections should be packed tightly together with very small gaps (4-6px) between them. This makes the rounded corners create soft seams between sections rather than floating islands of content. The overall effect should feel like one cohesive surface gently divided into zones. The rounded shapes of the cards and the rounded shapes of the fonts should echo each other.

--radius-sm:   8px;
--radius-md:   14px;
--radius-lg:   18px;
--radius-xl:   24px;
--radius-full: 9999px;

Cards use radius-xl. Buttons use radius-full for pill shape or radius-lg. Input fields use radius-lg. The outer container/page frame also uses radius-xl.

Inside cards: generous padding (20px-24px). Content inside should breathe.
Between cards: tight gaps (4-6px). Cards should almost touch, separated only by a hairline of the page background peeking through.
Page margin: 8-12px on mobile, 12-16px on desktop. The card grid should fill nearly the entire viewport width.

This creates the "packed mosaic" feel — lots of rounded rectangles tessellated tightly together, with lush padding inside each one.

### Anti-AI-Slop Rules — What Makes This Feel Designed

These are the specific patterns that separate a designed UI from generic AI output:

1. Nested rounded rectangles. Cards contain smaller rounded elements inside them (badges, progress bars, mini-cards, stat blocks). Every layer has rounded corners. It's rounded shapes inside rounded shapes. Never use sharp corners on anything.

2. Muted, desaturated palette. The greens and blues are never pure/saturated (#00FF00). They're always slightly grayed out, soft, pastel. The accent green should feel like sage/mint, not neon. The whole page should feel like it has a slight warm matte filter over it.

3. Large, bold stat numbers. When showing data (wait times, CTAS levels, symptom counts), use oversized numbers (2-3rem) in semibold/bold weight with tiny unit labels next to them. Like "25 min" where 25 is huge and "min" is tiny.

4. Colored indicator bars and progress strips. Thin horizontal gradient bars under stats to show ranges (optimal to suboptimal). Use these for wait time severity, symptom tracking progress, etc. These are always rounded-full and only about 4-6px tall.

5. Soft iconography inside tinted circles. Icons sit inside small circles or rounded squares with a tinted background matching their category color. Never raw icons floating in space. For example: a heart icon inside a soft pink circle, a map pin inside a soft blue circle.

6. Visual hierarchy through card size, not just text size. Important information gets a bigger card, not just a bigger font. The care routing "best option" should be a larger card than the alternatives. The active triage alert should visually dominate.

7. Subtle tag/pill labels everywhere. Small rounded pill labels for categorization: "Walk-in", "ER", "Urgent", "Day 4 of 10", "Logged 3 days ago". These are in soft colored backgrounds with small text. They add visual richness without clutter.

8. No visible borders on most elements. Cards are distinguished by their background color and shadow against the page background, NOT by visible borders. Use borders extremely sparingly — only for interactive inputs. The separation comes from the tight gap between cards showing the page background color.

9. Asymmetric grid layouts. Not everything is equal-width columns. Use layouts like 2/3 + 1/3, or a big card next to two stacked small cards. Break the grid occasionally.

10. White space inside, density outside. Lots of breathing room inside each card. Very tight packing between cards. This creates a rhythm of dense then open then dense then open that feels premium.

DO NOT:
- Use gradient backgrounds on the page (keep it flat off-white)
- Use colored header bars or nav backgrounds (keep nav minimal, white/transparent)
- Use large hero sections or banner areas (every pixel should be functional)
- Use generic placeholder illustrations or stock icons
- Put heavy drop shadows on anything (shadows should be barely perceptible)
- Use more than 2 font weights per element (usually just regular + semibold)
- Put outlines/rings on focused elements in bright blue (use subtle accent color instead)

### Shadows

Soft, layered shadows. Never harsh.

--shadow-sm:   0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
--shadow-md:   0 4px 12px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.03);
--shadow-lg:   0 8px 24px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03);

### Component Patterns

Cards: White background, radius-xl, no visible border (separation comes from gap showing page bg). On hover: shadow-md transition.

Buttons:
- Primary: bg accent green, white text, pill shape, shadow-sm. Hover: accent-hover.
- Secondary: bg surface, text-primary, border, pill shape. Hover: surface-soft bg.
- Danger: bg danger-soft, danger text. For urgent actions.

Badges/Pills: Used for CTAS levels, symptom severity, care type, entry status.
- CTAS 1 (Resuscitation): danger bg
- CTAS 2 (Emergent): warning bg  
- CTAS 3 (Urgent): info bg
- CTAS 4 (Less Urgent): accent-soft bg
- CTAS 5 (Non-Urgent): surface-soft bg
- Entry status: Resolved (accent-soft), Watching (warning-soft), Needs Attention (danger-soft), Active (info-soft)

Care Routing Cards: When triage fires, show a card with clinic name (bold), type badge (Walk-in / ER / Urgent Care / Telehealth), wait time (large number colored by urgency), distance + address, hours with open/closing status, and a subtle map pin icon.

## UX Architecture — THIS IS CRITICAL

Medunity is NOT a chatbot. The user logs what's going on with them, the system asks smart follow-ups, and then the real value kicks in: accurate triage assessment, real-time care routing, and longitudinal memory connecting entries over time.

The conversation is just the input mechanism. The PRODUCT is the entry cards with triage scores, the care routing, and the overview analytics.

### The Interaction Model

1. New Entry

A prominent input area at the top. Not a chat box — a submission field. Think posting a status update.

- Text input with placeholder: "Something feel off?"
- Photo upload button (rashes, swelling, pill bottles, discharge papers)
- Quick-tap pills below: "Headache", "Stomach", "Fatigue", "Pain", "Anxiety", "Doctor visit"
- Submitting creates a new entry card with a timestamp

2. Entry Cards (the core UI element)

Every entry becomes a card in the feed. Each card shows AT A GLANCE — no need to open it:

- Timestamp
- The user's original text (verbatim)
- Extracted symptoms as colored tag pills — these are what the system actually logged
- CTAS score badge — color-coded urgency level with label (e.g., "CTAS 4 · Less Urgent"). This is the fine-tuned model output. Make it prominent.
- Links to previous entries — if the system connected this to something earlier, show it as a clickable link
- Assessment summary — 1-2 sentences: what the triage model determined and what action is recommended
- "Find care near me" button — triggers the real-time care routing
- "Expand thread" toggle — reveals the full follow-up conversation underneath. Collapsed by default.

Card states:
- Active (blue badge) — agent is still asking follow-up questions
- Resolved (green badge) — complete, CTAS scored, logged
- Watching (amber badge) — resolved but flagged for monitoring
- Escalated (red badge) — urgent, care routing triggered

3. The Follow-Up Conversation (inside expanded cards)

When you tap "Expand thread", it reveals the short conversation that happened after submission. This is 2-5 exchanges where the agent asked clarifying questions. Stored for reference but NOT the primary interface — the card summary is.

The agent's follow-up questions are smart because they're informed by what COMBINATION of symptoms is present, they reference previous entries ("Is the headache from Monday still happening?"), and they ask the specific questions that would CHANGE the triage level.

4. Care Routing (when "Find care near me" is tapped)

This is the wow moment. A panel/modal slides up showing the triage assessment at top ("CTAS 4 · Less Urgent. Recommended: GP or Walk-in within 1 week"), then clinic cards sorted by relevance with name, type badge, wait time (large number), distance, hours with open/closing status, and services offered. Include contextual notes like "Based on your symptoms, blood work is recommended. Clinics with 'Blood work on-site' can handle this in one visit."

5. Overview Panel (analytics + health snapshot)

Right side on desktop, separate tab on mobile. Shows:

- Health Status: overall summary from recent entries
- Entry History: compact list with CTAS badges, tap to jump to card
- Symptom Frequency: bar chart showing most common symptoms in past month
- Active Treatments: medication progress bars, referral status, follow-ups
- Pattern Alerts: ONLY appears when flagged. Shows pattern description + CTAS trend + "Find care now" button.

### Page Layout

Desktop (>768px): Two-column. Left = FEED (60%) with entry bar + card feed. Right = OVERVIEW (40%) with health status, entry history, symptom frequency, pattern alerts, treatments.

Mobile (<768px): Bottom tabs: Feed | Overview. Care routing as slide-up panel.

### Animations

- New entry card: slides down from entry bar, 250ms ease-out
- Card expand/collapse: smooth height transition, 200ms
- Care routing panel: slides up from bottom, 300ms with slight spring
- CTAS badge: scale pop from 0.9 to 1 on appear
- Pattern alert: fade in with subtle left-to-right reveal
- Skeleton loaders for async content (shimmer on surface-soft)

### Icons

Lucide React:
- Plus (new entry), Camera (photo), Activity (overview), Clock (timestamps/wait times)
- MapPin (care routing), AlertTriangle (pattern alerts), Pill (treatments)
- CheckCircle (resolved), Eye (watching), ChevronDown (expand card)
- ArrowRight (find care), Stethoscope (CTAS/triage), Link (connected entries)

### Logo

"medunity" in Plus Jakarta Sans, 700 weight. "med" in var(--color-text-primary), "unity" in var(--color-accent).

## First Task

Set up the Next.js frontend with:
1. App Router structure
2. Tailwind CSS configured with the custom color palette above as Tailwind theme extensions
3. Google Fonts loaded (Plus Jakarta Sans + DM Sans)  
4. Global CSS with all the CSS variables defined
5. Reusable components in /components/ui: Button, Card, Badge, Input, Avatar, StatusPill, CTASBadge, SymptomTag
6. The two-column layout shell (feed 60%, overview 40%) with mobile bottom tab navigation
7. Hardcoded demo data showing the complete product:
   - Entry bar at top with quick-tap pills
   - One ACTIVE entry card (blue, CTAS 4, shows extracted symptoms, linked to previous entry, assessment visible, "Find care" and "Expand" buttons)
   - Two RESOLVED entry cards (green, collapsed, showing summary + CTAS badge + symptom tags)
   - Overview panel with: health status summary, entry history list with CTAS badges, symptom frequency visualization, a pattern alert card, and an active treatment tracker
   - When "Find care" is clicked: a care routing panel with 3 hardcoded clinic options (walk-in, campus health, telehealth) showing wait times, distance, hours, and services
   - Mobile: bottom tabs switching Feed / Overview, care routing as slide-up panel
8. Mobile responsive — test at 375px and 768px+

Also set up the FastAPI backend skeleton with:
1. Basic project structure  
2. requirements.txt with: fastapi, uvicorn, supabase, google-generativeai, httpx, python-dotenv
3. A health check endpoint
4. .env.example with placeholder keys

Don't build the agent, Modal scripts, or any backend logic yet. Just the skeleton and the polished UI shell with hardcoded demo data.