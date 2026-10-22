---
id: 2026-10-22-buff-spell-billed-as-attack
found: test
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** a test Spell that only buffs its caster, written like a test Skill, is a Skill to the use gate.
**Actual:** live, its slot read *"Test Use: Spell — this unit has already attacked this turn"*; the suite then failed `nursery.test.mjs` *"test-use-spell.yml deals no damage, so it declares countsAsAttack: false and its own targeting"*.
**Cause:** `module/rules/ability-use.mjs#classifyAbility @ b3da2d09` — `isSpell` is attack-shaped unless `countsAsAttack: false` says otherwise; I wrote the file from a Skill's shape without reading a buff Spell's.
**Fix:** `packs/_source/abilities/test-use-spell.yml @ uncommitted` — `countsAsAttack: false` and a self targeting block, as EMIYA's Reinforcement has. L2-19 and L2-20 were pressed on the old file through the same Skill path and failure door.
