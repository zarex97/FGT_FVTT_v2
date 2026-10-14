---
id: 2026-10-14-entry-uses-unread-on-skills
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Van Gogh's The Yellow House gives Evade 2 charges, as its entry `uses: 2` says.
**Actual:** Evade arrived with 1 charge. `uses` was read only on the intent path; the Skill path read `times` as charges and nothing else.
**Cause:** `module/engine/skill-use.mjs:1271 @ a436802` — `applyPhaseEffects` passed `uses: times` and never looked at the entry's `uses`.
**Fix:** `module/engine/landing.mjs:126 @ 1f1b099` — one door reads `uses` (and `times`) on every path.
