---
id: 2026-10-17-curse-floor-only-in-attack-pipeline
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Sunflower's Curse: *"Gogh's Health cannot drop below 1 due to the effects of Curse"*, so a Curse tick stops at 1.
**Actual:** Read while pressing Channel Marker Soul's tick: the floor (`DamageFloor`, defId curse) is applied only at stage 16 of the damage pipeline, keyed on the attack's `defId`. A Curse tick is a bare periodic `damage` intent (`bypassModifiers`) that never enters the pipeline, so no tick was ever floored; the unit tests held the pipeline function alone.
**Cause:** `module/engine/scheduler.mjs:2151 @ 8d1c012f` — `tickPeriodics` decided the tick's amount without the Unit's `damageFloors`.
**Fix:** `module/engine/scheduler.mjs` `flooredTick` @ 05211bb1 — the tick is held to the floors for its effect, against the Health the boundary's earlier ticks left.
