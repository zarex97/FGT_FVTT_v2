---
id: 2026-10-20-servant-master-lost-its-servants
found: test
kind: undeclared-field-dropped
status: fixed
reviewed: false
---
**Expected:** Rule Breaker gives Medea the Contract of the Servant it hit (#193 reading 18), and `setContract` keeps the Servant's `masterId` and its Master's `servantIds` reciprocal.
**Actual:** the test world refused the write: *"Actor(Medea): write to "system.servantIds" would be a Silent Drop — asked for ["anastasiaSummer0"], Foundry kept undefined."* Live, Anastasia's `masterId` read Medea and Medea's side of it was dropped without a word.
**Cause:** `module/data/actor/servant.mjs:56 @ 50eae993` — #193 gave a Servant `commandSpellsPerServant` so it could hold a Contract as a Master, and not `servantIds`, the other half every reader of a Master's roster asks.
**Fix:** `module/data/actor/servant.mjs @ uncommitted` — `servantIds` declared on the Servant.
