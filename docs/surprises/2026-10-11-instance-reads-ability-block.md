---
id: 2026-10-11-instance-reads-ability-block
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Dohatsu Tenshou deals four 0.5× BA(STR) sub-attacks, each half Lightning, Fire, Ice and Wind, then 3.5× BA(MAG) + 200 as the Noble Phantasm (R6, design §4.7).
**Actual:** Every card read "Ability multiplier —" and "Element —". The Noble Phantasm part read "Base BA(STR) +150" with no 3.5× and no +200. Medusa took 358, 364, 391, 419 and 310.
**Cause:** `module/engine/attack.mjs:5889 @ f15a3d1` — `damageBlockFor` returned the ability's top-level `damage` block, which only holds `instances`. Each instance's fields had been spread onto `state.attack` and read from there for `kind` and `excludeModifierSources`, while the damage step read multiplier, base and element from the block. Two readers of one instance, and only one of them was told.
**Fix:** `module/engine/attack.mjs @ b9884b9` — each process carries its whole instance as `instanceBlock`, and `damageBlockFor` returns it. `test/unit/raikou-195.test.mjs` checks a sub-attack and the Noble Phantasm part.
