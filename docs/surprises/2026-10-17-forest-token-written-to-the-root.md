---
id: 2026-10-17-forest-token-written-to-the-root
found: test
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** A Round's end beside Nursery gives an enemy Drake one Nameless Forest Token.
**Actual:** The test world refused the write: *"Actor(Francis Drake): write to "system.namelessForestTokens.value" would be a Silent Drop — asked for 1, Foundry kept undefined."* A live world drops it in silence, and the Token that arms the escape check and the death roll never lands on a Unit that has not held one.
**Cause:** `module/domain/resources.mjs#resourcePathFor @ eebbb988`: a key the Unit does not hold yet goes to the root of `system`, not to `resources`; the forest named `namelessForestTokens` and assumed every enemy held it.
**Fix:** `packs/_source/effects/nameless-forest.yml @ uncommitted` names the full path, `resources.namelessForestTokens.value`, and the count of times caught beside it; `nursery-247-rulings.test.mjs` applies a Round's end and reads the Token off the Drake.
