---
id: 2026-10-29-seat-move-lost-to-scatter
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** Usage 2 over the Carolus puts Karl on the CPA and his Master beside him.

**Actual:** Karl rode the CPA from (13,11) and his Master from (11,13), where the scatter dropped them, off its 2×2.

**Cause:** `module/engine/skill-use.mjs:3010 @ 8db88035` — the seat moves were written after the Carolus's teardown and were lost, before and after the new deck's activation alike.

**Fix:** `module/engine/skill-use.mjs:3015 @ 8db88035` — the teardown lands them there itself: `destroyPlatform({landings})` overrides the scatter for named Units.
