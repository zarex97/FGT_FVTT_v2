---
id: 2026-10-20-soaked-never-dried
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** Soaked (c): *"At the end of a Day Round, the 'Soaked' effect is removed from all affected Units"*: Nemo and Medea, Soaked in Round 1, a Day Round, dry at its end.
**Actual:** Round 1 ended (GM's Turn, tick 3) and both still held `soaked`. A Day board built for that boundary showed Nemo's handlers as `damageDealt` and two `damageTaken`, no `roundEnd`.
**Cause:** `module/rules/elements.mjs:244 @ 50eae993` — `self:phase:day` is a board annotation (`rules/snapshot.mjs#annotateEnvironment`, after collection), and `self:phase:` was not among the deferred prefixes, so the handler's predicate was answered at collection against a Unit with no phase yet, read false, and the handler was dropped. Asked of a passive rule nowhere else in the corpus.
**Fix:** `module/rules/elements.mjs#DEFERRED_PREFIXES @ 0552085c` — `self:phase:` is deferred like `self:inHomeBase`; the handler asks at the boundary, against the board's phase. `anastasia-258-rulings.test.mjs`, Day and Night, red before.
