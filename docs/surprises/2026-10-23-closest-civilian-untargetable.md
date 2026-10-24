---
id: 2026-10-23-closest-civilian-untargetable
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** a Civilian beside Dracula Vlad is "the closest Unit"; he must Attack it, and its death heals him 100
and 1 (Legend of Dracula 3, LD.civ).
**Actual:** R54 his compulsion named "Civilian A, Hassan 1", and his targeting struck the Civilian through: "a
Civilian, and Civilians are neutral; this ability targets enemy or ally".
**Cause:** `module/rules/ability-use.mjs:436 @ 2f18de06` — two readers of who he may Attack: the compulsion's pool
(`compulsion.mjs#nearestUnits`, any Unit) and the Attack's relations (`enemy` plus the compulsion's own `relations`),
which never named Civilians.
**Fix:** `module/rules/ability-use.mjs:438 @ 2f18de06` — a `nearest` compulsion adds `civilian` to the Attack's
relations.
