---
name: feedback_pattern_alert
description: Pattern alerts and AI summaries must be integrated into the 30-Day Overview, never shown as separate popups or conditional cards
type: feedback
---

Pattern alerts (recurring symptom patterns, trend badges, related entries) must be part of the 30-Day Overview component — always visible, with empty/placeholder state when no data exists. Never render them as separate conditional components that appear and disappear.

**Why:** User has asked for this multiple times and is frustrated by the pattern alert appearing as a separate popup card after survey submission instead of being integrated into the overview.

**How to apply:** Any health insight, AI summary, pattern detection, or trend information belongs inside the 30-Day Overview section. Don't create separate conditional cards for AI-generated insights. The overview should have sections that are always present but show placeholder content when empty.
