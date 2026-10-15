---
id: 2026-10-15-def-dwn-drained-on-a-knockbacks-damage
found: test
kind: generic-path-escapes-special-case
status: fixed
reviewed: false
---
**Expected:** the ticket (and the plan after reading `fields.mjs`): Def Dwn (A)'s Luck −1 and (C)'s Agility −1 drain on damage from a field, a toll or a cost. A bare `damage` intent was the suspect.
**Actual:** a bare 120-point damage intent drained nothing: those paths never raise `damageTaken`. The leak was the measured damage of Akhilleus Kosmos's Knockback, which the engine rules is *not an Attack* (#184 reading 8): `resolveAttack` with `placement.plainDamage` took Luck 1 and Agility 1 (`expected { luck: 1, agility: 1 } to deeply equal { luck: +0, agility: +0 }`).
**Cause:** `module/engine/attack.mjs:3050 @ 7231295` — a plainDamage Process runs the same ladder as an Attack and `fireDamageTaken` raises the event for it; the special case ("not an Attack") closed the reaction rungs (`:1156`) and nothing else, so every clause about damage "from an Attack" still heard it.
**Fix:** `module/engine/attack.mjs:774 @ f82cf94` stamps `plainDamage` on the declaration, `module/rules/options.mjs:100 @ f82cf94` emits `attack:plainDamage`, `packs/_source/effects/def-dwn-{a,c}.yml @ f82cf94` gate their drains on `not:attack:plainDamage`. `dioscuri-209-arena.test.mjs` fails with the option or the predicate removed.
