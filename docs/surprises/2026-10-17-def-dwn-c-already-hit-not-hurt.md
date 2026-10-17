---
id: 2026-10-17-def-dwn-c-already-hit-not-hurt
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** I told the user (reading 3) that Def Dwn (C)'s Agility −1 is built on "damage received", so a Block or a hit for 0 would not drain it, and recommended an instance option for Van Gogh's "successfully Attacked".
**Actual:** `damageTaken` is raised whenever `ridersFire` says the Unit was hit, "hit, not hurt" (#204 LI): a Block and a hit for 0 already drain. The readings differ only where the damage is skipped (an Instakill that empties the bar) or wholly negated (Anti-Purge, Substitution).
**Cause:** `module/engine/attack.mjs:3461 @ uncommitted` (`fireDamageTaken` under `riders`) — I described the event from its name, not from the line that raises it.
**Fix:** the corrected cases went back to the user, who ruled (3a to 3c): `module/rules/damage/riders.mjs#successfullyAttacked` @ uncommitted, read by `attackLanded` and the new `attackReceived`; every Def Dwn (A) and (C) drains once per Attack on the latter.
