---
id: 2026-10-29-suite-red-beside-live-foundry
found: test
kind: suite-flakes-under-load
status: fixed
reviewed: true
pattern: suite-flakes-under-load
---
**Expected:** the full suite at four workers, green at `774f082`, would stay green after a commit that changed four doc lines.
**Actual:** run with Foundry and two headless Chromiums still up in the cloud container: "Test Files 12 failed | 448 passed",
37 tests, mostly "Test timed out in 5000ms" and "The world saw what Foundry would not have said" (prompt timers firing
late). The same tree, after `fvtt-down` and the browsers killed: "Tests 8195 passed".
**Cause:** `docs/agents/cloud.md:1 @ 774f082` — the container's CPUs are shared by Foundry, both browsers (a WebGL canvas
in SwiftShader each) and the suite's workers; nothing said to stop them first.
**Fix:** `docs/agents/cloud.md @ uncommitted` — run the suite with Foundry down and the browsers closed.
