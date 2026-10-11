---
id: 2026-10-11-upkeep-on-wrong-turn-end
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** "At the end of Raikou's Turn and at the end of any Turn Raikou or any of her copies Acts, Raikou's Master loses 25 Health." Her Turn of switching it on ends with 26 → 1.
**Actual:** Her Turn ended and her Master kept 26. No upkeep line.
**Cause:** `packs/_source/abilities/raikou-tenmokaikai.yml:122 @ f15a3d1` — the handler sat on `turnEnd`, which fires only on her own side's Turn, and was gated on her Acting. Switching a mode on is not an Act, and a copy's Act on an enemy Turn never reached a `turnEnd` of hers.
**Fix:** `module/engine/scheduler.mjs @ uncommitted` — `fireEvent` adds `self:ownTurn` for the active side. The upkeep moved to `anyTurnEnd` with `or: [self:ownTurn, self:selfOrSummonsActed]`.
