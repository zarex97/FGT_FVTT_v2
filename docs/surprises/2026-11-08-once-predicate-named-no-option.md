---
id: 2026-11-08-once-predicate-named-no-option
found: live press
kind: unknown-value-falls-to-default
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** Fig Tree fires once. `predicate: [{ not: "self:resource:figTreeSpent:gte:1" }]` holds it back once `figTreeSpent` is 1 (ruling 23).
**Actual:** He was revived and defeated with `figTreeSpent` at 1. The card said *"Master of Archer of Faction 1: Invuln … regains 50 Health (Fig Tree of Tranquility)"* again.
**Cause:** `packs/_source/abilities/avicebron-fig-tree-of-tranquility.yml:27 @ dda17e6`: no reader builds a `self:resource:` option. The predicate was never false, and `{ not: … }` always passed. The unit test asserted the counter after a first fall and never pressed a second (passes for the wrong reason).
**Fix:** `packs/_source/abilities/avicebron-fig-tree-of-tranquility.yml:31 @ 5e770cb`: each action carries `whenValue: { stat: resources.figTreeSpent.value, lte: 0 }`, Habetrot's gate. `test/unit/avicebron-394.test.mjs` adds a second fall that gives nothing; it was red on the old content.
