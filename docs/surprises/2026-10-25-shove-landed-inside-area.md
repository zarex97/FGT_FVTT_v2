---
id: 2026-10-25-shove-landed-inside-area
found: test
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** A passed shove Moves the Master *"to one panel outside of the NP area"*.
**Actual:** Caladbolg's 3x3 around Drake at (5,5), her Master at (5,6): the shove landed the Master on (4,5), inside
the blast. Found writing `test/unit/cover-shove-press.test.mjs`, asked for by the user to check Cover and the shove
away from the live match.
**Cause:** `module/engine/attack.mjs:2720 @ cc1d8e41` — `resolveCover` took "the area" to be the panels its
defenders stand on, so every empty panel of the area read as outside it, for the shove and for "the Servant is
within the NP area".
**Fix:** `module/engine/attack.mjs:2730 @ d3452f94` — the area is the attack's own `areaPanels`, the defenders'
panels only when it carries none. The test fails without it.
