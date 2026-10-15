---
id: 2026-10-14-ride-took-any-ability
found: test
kind: generic-path-escapes-special-case
status: fixed
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** with the ride offer of Raikou's Mana Burst removed from the bar, no Mana Burst can ride.
**Actual:** `performRidingAttack({ abilityId: <Mana Burst> })` rode and hit Emiya: *"expected { ok: true, hit: [ 'emiya' ] } to deeply equal { ok: false, reason: 'notARide' }"*. The bar was the only gate; the engine and its socket took any ability.
**Cause:** `module/engine/riding.mjs:64 @ 7333e08` — the ride used whatever `abilityId` it was handed, so a macro or stale client could ride with any Skill.
**Fix:** `module/engine/riding.mjs:68 @ 95b91ea` — refuses an ability that is not itself a ride (`classifyAbility(...).ridesAsAttack`), worded `FGT.Action.Refusal.notARide`; `riding-attack-order.test.mjs` pins it.
