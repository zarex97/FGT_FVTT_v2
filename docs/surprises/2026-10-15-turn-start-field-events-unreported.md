---
id: 2026-10-15-turn-start-field-events-unreported
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Unlimited Blade Works' toll at each Turn's start shows its Evade rolls and damage, as a Turn-end field card does.
**Actual:** Scáthach and Heracles lost 25 and 50, then 25 each, with no card and no log line.
**Cause:** `module/engine/scheduler-hooks.mjs:337 @ 960496f` — `runFieldEvents("turnStart")` was run and never reported.
**Fix:** `scheduler-hooks.mjs @ uncommitted` posts them under "{field}: start of the Turn"; live: "Scáthach Evade 1d20 → 19: failed — Scáthach takes 100 damage".
