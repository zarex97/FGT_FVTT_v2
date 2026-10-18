---
id: 2026-10-18-normal-lancer-rolled-negative-luck
found: live press
kind: unknown-value-falls-to-default
status: open
reviewed: false
---
**Expected:** a Servant's Max Luck is never below 0.
**Actual:** the Great Holy Grail War built on 2026-10-18 committed Faction 2's Lancer with Max Luck −1: the Normal plan rolls `−2 + 1d20` for a Lancer and the die came up 1.
**Cause:** `module/rules/setup-rolls-normal.mjs:53 @ b7005fed` — `NORMAL_LUCK_BY_CLASS` gives Lancer −2 as the line's base, and nothing in `resolveSetupPlan` floors a rolled maximum at 0.
**Fix:** open, a rules question for the user: floor at 0, re-roll, or keep −1 (Luck Checks then never possible for that Lancer).
