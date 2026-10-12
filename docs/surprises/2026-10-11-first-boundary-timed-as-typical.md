---
id: 2026-10-11-first-boundary-timed-as-typical
found: retraction
kind: vps-drive-kit
status: fixed
reviewed: true
pattern: drive-kit
---
**Expected:** I told the user Turn boundaries take about 4 to 8 seconds, from one or two samples per branch.
**Actual:** Five timed boundaries per branch took 1.7–3.4 s for a Turn and 5–6 s for a Round. My earlier samples were first presses after a reload, which run slow or hang.
**Cause:** `scratchpad/perf.js @ 2076e53` — the samples came from the first `nextTurn` after a reload, the one case the open Surprise `2026-10-11-boundaries-skipped-after-reload` says misbehaves.
**Fix:** Time several boundaries, and skip the first after a reload. The corrected figures went to the user.
