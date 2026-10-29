---
id: 2026-10-29-master-fall-freed-servant
found: live press
kind: role-keyed-on-type
status: fixed
reviewed: false
---
**Expected:** *"Forcefully ended at the end of the Turn if Karl or his Master is defeated."*

**Actual:** His Master fell, Karl became Free ("Ruler is Free"), and the Carolus stood.

**Cause:** `module/engine/platforms.mjs:925 @ uncommitted` — the Master was read off Karl's live `masterId`, which the Master's fall clears; the board had his body only a tick.

**Fix:** `module/engine/platforms.mjs:929 @ uncommitted` — the summon writes `ownerMasterId` on the platform; his defeat is asked of his document.
