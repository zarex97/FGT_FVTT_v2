---
id: 2026-10-18-normal-lancer-rolled-negative-luck
found: live press
kind: unknown-value-falls-to-default
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** a Servant's Max Luck is never below 0.
**Actual:** the Great Holy Grail War built on 2026-10-18 committed Faction 2's Lancer with Max Luck −1: the Normal plan rolls `−2 + 1d20` for a Lancer and the die came up 1.
**Cause:** `module/rules/setup-rolls-normal.mjs:53 @ b7005fed` — `NORMAL_LUCK_BY_CLASS` gives Lancer −2 as the line's base, and nothing in `resolveSetupPlan` floors a rolled maximum at 0.
**Fix:** `module/rules/setup-rolls.mjs:337 @ 3d1a6d59` — ruled 2026-10-18: floored at 0. A plan line may carry `min`, and `resolveSetupPlan` never resolves below it; the Normal Servant's `maxLuck` line carries `min: 0` (`module/rules/setup-rolls-normal.mjs`). `test/unit/setup-rolls-normal.test.mjs` fails without it ("expected -1 to be +0"). The Lancer already committed with −1 keeps it until re-rolled.
