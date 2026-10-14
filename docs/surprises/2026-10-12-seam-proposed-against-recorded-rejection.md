---
id: 2026-10-12-seam-proposed-against-recorded-rejection
found: retraction
kind: proposal-against-recorded-decision
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** the architecture review's top candidate, a Combat Process store seam inside `module/engine/` with a Foundry adapter and a `world.mjs` adapter, was new ground.
**Actual:** `test/helpers/world.mjs` already records the same kind of seam as considered and rejected: "Faking the globals costs no production code and makes all of them reachable." The report never cited it.
**Cause:** `test/helpers/world.mjs:14 @ 832012d` — the rejection lives in the test helper's header, not in `docs/adr/`, and the review read the ADRs and the helper's gaps but not its rationale.
**Fix:** none in code. Wave A round 1, Q1, now recommends extending the faked globals (`game.messages`, `ChatMessage`, `Roll`, the ask route) and leaving the engine untouched.
