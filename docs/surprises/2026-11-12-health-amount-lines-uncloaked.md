---
id: 2026-11-12-health-amount-lines-uncloaked
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Every Health figure is cloaked to a Faction that has not bought END (CL.pool).
**Actual:** "Ruler regains 40 Health" and "Rider loses 30 Health" read open to Player1; only `statChangeLine` was cloaked.
**Cause:** `module/engine/turn-report.mjs:225 @ 56d4475` — the turn report and the applier's heal line write their own amount, past the one cloaked reader.
**Fix:** `module/engine/turn-report.mjs:225 @ 0d8224a`, `module/engine/applier.mjs:242 @ 0d8224a` — the amount is a cloak mark.
