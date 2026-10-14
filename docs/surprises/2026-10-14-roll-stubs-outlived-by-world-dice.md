---
id: 2026-10-14-roll-stubs-outlived-by-world-dice
found: test
kind: stub-outlived-by-harness
status: fixed
reviewed: false
---
**Expected:** once the test world rolled Foundry's real dice, every test that stubbed `globalThis.Roll` would either keep its stub or fail.
**Actual:** 13 tests in 5 files (`current-pools`, `effect-intent-permanence`, `field-or-trigger`, `field-turn-end-scope`, `poison-escalation`) went on passing with their stub ignored. Their premise, "every chance lands on 1" or "every d100 is 100", was replaced by the seed's luck. Only `roll-records` failed.
**Cause:** `test/helpers/world.mjs @ uncommitted` — `withWorld` installs its own `Roll` over whatever the test set, and nothing said so.
**Fix:** `test/helpers/world.mjs @ uncommitted` — a world that rolls an unset die while a test's `Roll` stub is in place fails, naming `w.dice`. The five files state their premise with `worldDefaults({dice: {every: n}})`.
