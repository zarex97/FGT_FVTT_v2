---
id: 2026-10-29-mount-handler-deaf-to-rider
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** The CPA's *"Normal Attacks at a Range of 1 to 2 knocks back the DU(s)"* fires on its swing.

**Actual:** Karl's Normal Attack from the CPA dealt 224 with the mount's BA(STR) and Arturia did not move.

**Cause:** `module/engine/attack.mjs:7463 @ uncommitted` — `damageStepEnd` fired on the attacker alone; `damageDealt` added a platform's driver, never a rider's mount.

**Fix:** `module/engine/attack.mjs:6029 @ uncommitted` — `swingHearers` serves both: the attacker, a mount's driver, and the mount whose swing a rider's Normal Attack is.
