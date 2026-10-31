---
id: 2026-10-31-multi-panel-range-from-anchor-corner
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Summer Habetrot's Shisarot Form Normal Attack reads its band per DU by distance (ruling 30): Kingprotea touching her right half at Range 1 is struck with BA(STR).
**Actual:** 'Base BA(MAG) +150' on Kingprotea beside her (tick 4), as on Asterios two away.
**Cause:** `module/engine/attack.mjs:8677 @ 7b1e3c86` — `attackDistance` measured from her anchor panel, one corner of her 2x2; `rules/targeting/resolve.mjs` (delivery) and `rules/compulsion.mjs` (Decoy reach) did the same, while `engine/landing.mjs` already measured footprint to footprint.
**Fix:** `module/domain/geometry.mjs` `occupiedPanels`, `chebyshevBetween` @ uncommitted — one reader, used by `attackDistance`, the targeting delivery, Decoy and landing; pressed live again at tick 18: Kingprotea at 1 BA(STR) 115, Van Gogh at 2 BA(MAG) 150.
