---
id: 2026-10-15-joint-np-union-already-double-counts
found: test
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** the ticket's *"Differs: built as a union"* — two Divine Cores would count once.
**Actual:** an arena press of Castor's Guardians of Navigation then the joint NP showed `[80, 80]` for the Divine Core and each twin's Atk Up and NP DmUp, with the partner's lines labelled "(Pollux)": counted twice, already.
**Cause:** `module/rules/damage/pipeline.mjs:1367 @ 7231295` — `activeMods` concatenates the partner's whole bag, and its comment says why: *"DOUBLE-COUNTING IS INTENDED (Ch. 41 Q12, answered by the game's author)"*. "Union" was the Servant sheet's `modifierCombination: union` key, a name for "added together", not set union.
**Fix:** none needed; pinned in `dioscuri-209-arena.test.mjs` (the NP, and a Normal Attack that must NOT combine). Removing the union fails it.
