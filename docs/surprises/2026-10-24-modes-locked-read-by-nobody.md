---
id: 2026-10-24-modes-locked-read-by-nobody
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** after his Master fell with Mad Enhancement Active, the card said *"it cannot be deactivated"*, and
Player1's toggle refuses.
**Actual:** Player1 pressed Mad Enhancement on the bar and it switched off. The tooltip read only "Mad Enhancement".
**Cause:** `module/engine/io.mjs:2018 @ 4f6f04ab` wrote `system.modesLocked` at the Master's death, and only the
sheet's badge read it. `module/rules/modes.mjs#canToggleMode @ 4f6f04ab` never asked, and the snapshot never
projected it. Nothing cleared it at a new Contract either.
**Fix:** `module/rules/snapshot.mjs @ uncommitted` projects `modesLocked`. `canToggleMode` refuses
`modesLocked` both ways, the bar and the sheet with it. `io.setContract` clears it on a new Contract.
