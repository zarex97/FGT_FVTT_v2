---
id: 2026-10-28-target-unit-anchor-aims-one
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** Sudarshana's `targetUnit` anchor with `chooser: chosen, count: 2` would let Player1 click two enemies.
**Actual:** The first click opened the review, "1 target(s) · 1 panel(s) Lancer", and a second could not be added.
**Cause:** `packs/_source/abilities/rama-sudarshana.yml:31 @ 02fe93eb` — a `targetUnit` anchor aims at one Unit; `count: 2` is read among the Units a shape holds (Hassan's Librarian's `self` + `chebyshevRadius`). I authored it without reading a live two-pick.
**Fix:** `packs/_source/abilities/rama-sudarshana.yml:34 @ 76845db4` — `anchor: self`, `shape: attackRange r 3`, two picks among the enemies in his Range. Test: `rama-347.test.mjs` "strikes two enemies within 3".
