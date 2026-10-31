---
id: 2026-10-31-keyed-negation-unnamed
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** GF.2: Guardian Faerie negates a Class-keyed increase for that Unit, and the card says why it is missing.
**Actual:** Van Gogh's staged Pretender (>Caster) is simply absent from Tamamo's breakdown under Guardian Faerie (tick 9).
**Cause:** `module/rules/damage/pipeline.mjs` `activeMods @ 7b1e3c86` — `negateKeyedDealt` drops the modifier with no note.
**Fix:** `module/rules/damage/pipeline.mjs` `negatedHere` @ a93cc681 — a note 'Pretender (>Caster) negated by Guardian Faerie'; pressed live on Asterios's attack on Tamamo.
