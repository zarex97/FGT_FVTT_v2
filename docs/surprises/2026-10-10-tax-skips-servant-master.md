---
id: 2026-10-10-tax-skips-servant-master
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** Medea holds Medusa and Quetzalcoatl after two Rule Breakers. Both Act, and at the Turn's end she loses 25 (reading 21).
**Actual:** Medea stayed at 750, and no tax line appeared.
**Cause:** `module/engine/scheduler.mjs:2253 @ 27c8858` billed only Units of `kind: "master"`. It is the same assumption Rule Breaker's Contract made: a Master is a `master` actor.
**Fix:** `module/engine/scheduler.mjs @ uncommitted` bills whoever holds a Contract.
