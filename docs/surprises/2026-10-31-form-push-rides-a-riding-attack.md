---
id: 2026-10-31-form-push-rides-a-riding-attack
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: false
---
**Expected:** Ruling 10: the Form's 2x2 and knockback do not add to her Riding Attack.
**Actual:** 'AlterEgo is knocked back 1 panel by Pretender.' after her ride (tick 6).
**Cause:** `packs/_source/effects/shisarot-form.yml:73 @ 7b1e3c86` — the push's predicate was `attack:kind:normal`, and a ride is one.
**Fix:** `packs/_source/effects/shisarot-form.yml:73 @ uncommitted` — `not:attack:kind:ridingAttack`; pressed live at tick 14: no push.
