---
id: 2026-10-15-both-twins-restored-one
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Pollux's Mana Burst, "Restore 1 Agility and 1 Luck to both twins": Pollux and Castor each +1 Agility and +1 Luck.
**Actual:** Pollux 15 → 16 Agility, 8 → 9 Luck. Castor stayed at 14 of 18 Agility. The card read "Agility +1, Luck +1".
**Cause:** `module/engine/skill-use.mjs#phaseTargets @ 960496f` — both Mana Bursts author `target: linkedGroup` on the branch's `statChange`; the executor knew `self` and `reuse`, and anything else fell to the caster. `phase-targets.test.mjs` read top-level phases only.
**Fix:** `module/engine/skill-use.mjs#phaseTargets @ 3cc6a34` — `linkedGroup` is the caster and its twin; the guard walks a `choose` branch's phases; `dioscuri-209-live.test.mjs` plays both Mana Bursts.
