---
id: 2026-10-11-copies-inherit-derived-mov
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** Each Raikou copy has "the same MOV as Raikou", her base 4 (reading 7).
**Actual:** All four copies read MOV 9.
**Cause:** `module/engine/summoning.mjs:381 @ f15a3d1` — `inherit` read the summoner's prepared `system.mov`, which already holds her Riding +5. A scalar stat on the document is the derived number, not the authored one.
**Fix:** `module/engine/summoning.mjs:381 @ b9884b9` — a scalar inherit reads `summoner._source.system[stat]` first.
