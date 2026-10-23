---
id: 2026-10-23-cannot-react-offered-an-ability
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** Four Elements' face 5: *"if the DU failed to Evade the first hit, it cannot React to the second hit"*
(#328 ruling 16): the follow-up offers its DU nothing but taking it.
**Actual:** pressed live 2026-10-23, Round 43: Heracles failed his Evade, and the follow-up's rung offered "nothing"
and his reaction ability Eye of the Mind (False). Evade, Block and Counter were closed; the ability rung was not.
**Cause:** `module/engine/attack.mjs:1133 @ 7f02a2c2`: `defenderFields` drops reaction abilities only for
`plainDamage`; a placement's `forbidReactions` named the three standing rungs alone.
**Fix:** `module/engine/attack.mjs @ 7f02a2c2` and `module/engine/attack-riders.mjs#riderLockedReactions`:
`abilities` in `forbidReactions` closes the reaction abilities, and a failed Evade's lock names it.
