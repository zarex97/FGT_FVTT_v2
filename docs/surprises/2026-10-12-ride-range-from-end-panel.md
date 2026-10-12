---
id: 2026-10-12-ride-range-from-end-panel
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** a Unit struck in passing by a Riding Attack is struck where she meets it, at Range 1 (#197 Q3, ruled 2026-10-12).
**Actual:** Holder Mode's range-banded Normal Attack measured from the panel where the ride ended. Medea, struck 2 panels into the ride, took the Range-3 BA(MAG) band.
**Cause:** `module/engine/attack.mjs:5757 @ 75ae578` — `attackFacts` takes the Range from `attackDistance(attacker, defender)`, and by then the ride has already moved her to its end.
**Fix:** `module/engine/attack.mjs:5760 @ 57c23ae` — a ride's hit (`state.attack.ride`) is at Range 1. Pressed live: Medea, one panel into a four-panel ride, took "BA(STR) × 1 +150, BA(MAG) × 0.3 +75".
