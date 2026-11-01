---
id: 2026-11-01-nondamaging-np-drained-def-dwn
found: live press
kind: rule-word-read-one-way
status: fixed
reviewed: true
pattern: rule-word-read-one-way
---
**Expected:** Rhongomyniad Mythos, *"(Non-damaging)"*, would deal no damage and so trigger nothing that fires on *"damage received from an Attack"*.
**Actual:** Its card on Mannanán read *"Mythos · Agility 13 → 12 (Def Dwn (C))"*: the Process counted as a successful Attack.
**Cause:** `packs/_source/effects/def-dwn-c.yml` drains on `attackReceived`, and #239's reader (`riders.mjs#successfullyAttacked`) counts "a hit for 0"; my `combatProcess` Process reaches the Damage Step with 0, so it reads as one. Whether a non-damaging Process is a "successful Attack" was never put to the user.
**Fix:** `module/engine/attack.mjs @ cf32f43a`: ruled #362 Q9 (b). The attack spec carries `nonDamaging`; damage hearers, `attackReceived`, `attackLanded` and the hit counts (`attack.mjs`, `rules/use-record.mjs`) skip it.
