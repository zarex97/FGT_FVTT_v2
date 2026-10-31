---
id: 2026-10-31-ride-swept-by-anchor-line-only
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** Ruling 10: in the Form her Riding Attack path is as wide as she is, each Unit in it struck once.
**Actual:** At tick 6 her ride struck Kingprotea (her anchor's row) and passed Asterios in her second row unstruck.
**Cause:** `module/rules/movement.mjs:369 @ 7b1e3c86` — `ridingHits` matched Units against the anchor's walked line only.
**Fix:** `module/rules/movement.mjs:375,408 @ fd0d2bbe` — `sweptByFootprint`; pressed live at tick 14: both struck.
