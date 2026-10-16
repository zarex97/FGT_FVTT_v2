---
id: 2026-10-16-selection-filter-own-vocabulary
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Arturia's Master, in his Home Base with Karna's Master beside him, hands [Avalon] on with "Avalon (pass to a Master)" (#230 AV.pass, reading 16).
**Actual:** "No legal targets for this ability. Refused: … Master of Lancer of Faction 1 is excluded by this ability's target predicate."
**Cause:** `module/rules/targeting/resolve.mjs:1419 @ b4464ed` — a selection's `attributes` predicate is tested against `optionsForUnit`, a set of three facets (type, attribute, effect) of its own; `target:inHomeBase`, which `rules/options.mjs` emits for every other reader, was never in it. I authored the pass's filter against the predicate grammar and tested the pass with no press of it.
**Fix:** `module/rules/targeting/resolve.mjs#optionsForUnit @ uncommitted` — the candidate's whole target side from `rollOptionsFor`, beside the three. Arena test passes the Item between two Masters.
