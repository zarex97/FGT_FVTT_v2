---
id: 2026-10-11-granted-element-not-authored
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Under Tenmōkaikai, Raikou's attacks deal Lightning damage (half) (R5).
**Actual:** Her Normal Attack's process carried `element: null`. Nothing on her NP granted an element.
**Cause:** `packs/_source/abilities/raikou-tenmokaikai.yml @ f15a3d1` — the clause was never authored, and `AttackProperty` dropped a string value. No reader took an element from the attacker's state.
**Fix:** `module/engine/attack.mjs @ b9884b9` — `AttackProperty element lightning` and `elementFraction 0.5` on the NP. `withGrantedElement` puts it in the attack's facts for an element-less attack.
