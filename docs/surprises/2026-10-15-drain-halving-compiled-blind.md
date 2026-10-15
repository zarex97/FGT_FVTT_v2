---
id: 2026-10-15-drain-halving-compiled-blind
found: live press
kind: passes-for-the-wrong-reason
status: fixed
reviewed: false
---
**Expected:** Castor countered in Faction 2's Turn, diagonally next to Pollux. The Turn's end halves Mad Enhancement's drain: his Master loses 10.
**Actual:** "Master of Saber of Faction 1 loses 20 Health (Mad Enhancement)."
**Cause:** `module/rules/snapshot.mjs#contributionsOf @ 960496f` — the drain's `tableFactor` reads `self:withinOfPartner:1` when the rules compile, inside `snapshotUnit`, before `annotateLinkedGroups` gives the twin a distance. `linked-group.test.mjs` handed the distance in by hand, so it passed.
**Fix:** `module/rules/snapshot.mjs#recollectForPartner @ uncommitted` — the board pass re-collects a twin's handlers with its partner distance; `test/unit/dioscuri-209-live.test.mjs` asks the real board: 10 diagonal, 20 at two.
