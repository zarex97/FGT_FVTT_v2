---
id: 2026-11-13-docs-count-intents-and-tests-stale
found: tooling
kind: claim-without-reading-the-path
status: open
reviewed: false
---
**Expected:** The docs' counts size the engine's contracts. `docs/02-architecture.md:126` says the intent set is *"frozen at 36 types"*. `README.md:111`, `README.md:153` and `README.md:160` say *"5,021 unit and golden tests, no Foundry required"*. A plan for the Godot port, sizing the write contract and the test oracle, would read them there.
**Actual:** `INTENT_TYPES` holds 48 types. The suite runs 8,489 tests across 478 files (run 2026-11-13 at four forks), and it needs Foundry's source at `../foundryVTT_copy`. The authoring vocabulary drifted too: docs 10 and 39 give 54 elements, 62 facets and 20 requirements, where the code holds 91 elements, 89 facets and 33 requirements (a subagent's count, not yet recounted by hand). `docs/21-combat-process.md:59` says an Injury Roll loses *"Agility equal to the damage taken"*. `module/engine/attack.mjs:5894` rolls `1d4`, as `docs/C-dice-registry.md:23` states.
**Cause:** `module/engine/intents.mjs:23 @ 624eccf2` gained twelve types since `docs/02-architecture.md:126 @ 624eccf2` was written, and nothing checks the prose count against the array. The README predates the move of the tests onto real Foundry (ADR-0006).
**Fix:** Open. The counts in `docs/02`, `README.md`, `docs/10` and `docs/39` need correcting, or a guard that reads them off the code. Until then, the port plan takes every count from the code.
