---
id: 2026-10-17-rewind-update-dropped-whole
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** With history wired, the rewind writes Arturia's recorded Health back.
**Actual:** The rewind's own intent read `health {value: 1225, max: 1225}`, and after it her Health was still 900. `actor.update({"system.health": …})` alone worked; with `"system.parameters": {str: {}, end: {}, …}` beside it, nothing in the update landed.
**Cause:** `module/rules/history.mjs#snapshotUnit @ eebbb988` recorded the projection's `parameters`: Rank objects with granted steps folded in, which the combat flag's clone turns into `{}`. A JSON round trip hides this, through `Rank#toJSON`.
**Fix:** `module/rules/snapshot.mjs @ 7755ebb4` projects `storedParameters`, the sheet's letters, and the history records those; `module/engine/io.mjs#rewind @ 7755ebb4` writes parameters only when they are letters, for records made before.
