---
id: 2026-10-10-zero-sail-toggled-off-inside
found: live press
kind: mode-with-a-way-out-elsewhere
status: fixed
reviewed: false
---
**Expected:** while submerged, Zero Sail stays Active until the Storm Border resurfaces; the only way out
is the Resurface control.

**Actual:** clicking Zero Sail on Nemo's bar inside switched the mode off with no word. The dimension
stood, Nemo and his Master were still on its Level, and `self:skillActive:zeroSail` was false — so
Voyager of the Storm's and Journey's Guidance's Storm Border branches stopped reaching anyone aboard.

**Cause:** `packs/_source/abilities/nemo-zero-sail.yml @ 08ea4b1` is an ordinary mode, which its owner
may toggle; nothing tied the switch to the dimension.

**Fix:** `packs/_source/abilities/nemo-zero-sail.yml @ d162f50` — `deactivation: { byOwner: false }`;
the resurface switches it off on the forced path.
