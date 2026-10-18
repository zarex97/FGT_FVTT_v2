---
id: 2026-10-17-forest-left-a-masters-base-attack
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** The forest's *"Base Attack (both) by 10"* lands on every enemy it catches, Masters and summons included (FO.who).
**Actual:** At the Round's end Master of Berserker took the Token, Max Health 161 → 136 and Max Luck 15 → 14, and kept BA 100/100. Heracles lost his 10 each.
**Cause:** `module/data/actor/master.mjs @ eebbb988` took `turnState, roundState, baseAttack` from `combatantCommon()` and not `baseAttackPenalty`, so Foundry dropped the write; `module/data/actor/simple.mjs#SummonData @ eebbb988` stored it and nothing subtracted it, since only a Servant's `baseAttackFor` reads it. The test world never ran a type's `prepareDerivedData`, and the forest test asserted the stored penalty on a Servant only.
**Fix:** `module/domain/base-attack.mjs#penalizedBaseAttack @ 7755ebb4`, run by the Master's and the summon's `prepareDerivedData`; the Master declares the field; `test/helpers/world.mjs#prepare` runs the type's derived pass as Foundry does. `nursery-247-rulings.test.mjs` reads a Master's and a Trump Soldier's projected Base Attack after a Round's end.
