---
id: 2026-10-10-freeing-skips-servant-master
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** Medea defeated, her stolen Medusa and Quetzalcoatl go Free or are conquered (reading 18).
**Actual:** Both stayed `contracted` to Medea's body.
**Cause:** `module/engine/io.mjs:1551 @ 27c8858` — `freeContractedServants` returned unless the defeated actor was of type `master`. This is the third reader in this audit to assume a Master is a `master` actor, after Rule Breaker's Contract and the multi-Servant tax.
**Fix:** `module/engine/io.mjs @ uncommitted` runs for whoever holds a Contract. Live: both went Free.
