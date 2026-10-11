---
id: 2026-10-10-summon-dismissal-hits-synthetic-actor
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** Medea's defeat dismisses her Dragon Tooth Warriors: tokens and actors gone (reading 15).
**Actual:** First nothing was dismissed. Then, with the dismissal added, the defeat threw `undefined id [...] does not exist in the EmbeddedCollection collection`, Medea stayed undefeated, and the Warriors' world actors stayed behind with no tokens.
**Cause:** `module/engine/io.mjs:1001 @ 27c8858` — `dismissSummon` deleted `resolve(unitId)`, which prefers an unlinked token's synthetic actor. Deleting that removes the token, and then the token loop deleted the same token again. The world actor was never touched. Any summon dismissed this way, such as the Jabberwock at expiry, left one behind.
**Fix:** `module/engine/io.mjs @ 40e21e7` deletes tokens one at a time by scene query, then the world actor. It dismisses the summoner's Warriors after the defeat is written. Live: two Warriors, both tokens and both actors gone.
