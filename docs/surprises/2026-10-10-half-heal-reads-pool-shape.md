---
id: 2026-10-10-half-heal-reads-pool-shape
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** Medea spends one of her stolen Command Spells on Half Heal, and Medusa recovers half her maximum Health.
**Actual:** "Medea spends 1 Command Spell(s): Half Heal." The spell was spent, and Medusa stayed at 402. EMIYA's own Master got the same result, so every Half Heal and Full Heal in the game restored 0.
**Cause:** `module/rules/command-spells.mjs:327 @ 27c8858` read `unit.health.max`. The live context hands it the board snapshot, where `health` is a number and the maximum is `maxHealth`. `test/unit/command-spells.test.mjs` used `{value, max}` pools, so it agreed with the code.
**Fix:** `module/rules/command-spells.mjs @ 40e21e7` reads `max<Stat>` beside a number. `module/rules/snapshot.mjs` now projects `maxAgility`, and a test uses the board shape.
