---
id: 2026-10-31-nondamaging-process-offered-abilities
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** Rhongomyniad Mythos's Process would leave its DU an Evade and nothing else (reading 20).
**Actual:** Block and Counter were closed, but Medea was offered her reaction abilities Argos and Trofa.
**Cause:** `module/engine/attack.mjs#defenderFields @ fe7e8891` closed the rungs through `unblockable`/`uncounterable` and offered `offeredReactions` regardless.
**Fix:** `module/engine/attack.mjs#defenderFields @ 0c363285` offers no reaction ability when the ability's `combatProcess.reactions` names its reactions.
