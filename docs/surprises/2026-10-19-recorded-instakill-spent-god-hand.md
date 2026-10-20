---
id: 2026-10-19-recorded-instakill-spent-god-hand
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** reading 6 (#256): once Gáe Bolg Alternative's Instakill is recorded, its next Instakill leaves Heracles at 1.
**Actual:** the second Gáe Bolg Alternative, *"Instakill (rolled 10 vs 75%)"*, then *"Berserker is defeated and revived by God Hand: Twelve Labors, with 20 Health. Uses spent: 1; 3 left."*
**Cause:** `module/engine/attack.mjs:5830 @ d64553fc` — the recorded-Attack floor clamps the DAMAGE step's total, and an Instakill skips the damage: it lands as a terminal `reduceToZero` in `engine/effect-applier.mjs#terminalIntents`, which no floor read. The ledger recorded it (the defeat path asks the Process), so one Attack was "recorded" to one reader and "never seen" to the other.
**Fix:** `module/engine/landing.mjs:199 @ ded45740` — an applied `reduceToZero` from a recorded Attack leaves 1 Health, and its card line says so. The three readers ask `rules/revival.mjs#identityOfProcess`. `test/unit/heracles-256-rulings.test.mjs`.
