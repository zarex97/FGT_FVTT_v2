---
id: 2026-10-17-offer-scan-missed-the-alias
found: test
kind: passes-for-the-wrong-reason
status: fixed
reviewed: false
---
**Expected:** `tools/check-offers.mjs` would refuse the free-Spell prompt, the very site #244 names as the one a
matrix written before it could not have held, if its list stopped asking `offerable`.
**Actual:** With `offerable(` renamed in `attack.mjs`, the scan reported the window alone. The free-Spell prompt
maps `candidates`, built from `ofCategory`, which is built from `owner.items`, and the scan read only the list's
own declaration: green, because it could not see.
**Cause:** `tools/check-offers.mjs#abilityOffers @ uncommitted` tested `.items` on the mapped list's declaration
alone, never on the lists it is built from.
**Fix:** `tools/check-offers.mjs#listOf @ uncommitted` follows the declaration back three lists deep;
`offer-gate-244.test.mjs` asserts the aliased prompt is refused and passes once it asks `offerable`.
