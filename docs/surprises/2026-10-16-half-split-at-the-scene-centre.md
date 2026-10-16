---
id: 2026-10-16-half-split-at-the-scene-centre
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** Round 3's deploy offers Hassan's Master's half of the field: rows 0 to 6 of the 13x13 war.
**Actual:** the highlight ran diagonally, down to row 14 on the left columns and nothing on the right.
**Cause:** `module/rules/linked-group.mjs:240 @ ef0d49e` — the half was cut at the scene's centre; the war (13x13) was built on an older 21x21 scene, whose centre is not the war's.
**Fix:** `module/rules/linked-group.mjs:240 @ ef0d49e` — the half is cut on the line between his Home Base and the nearest enemy Home Base; the scene's centre is the fallback with no enemy base.
