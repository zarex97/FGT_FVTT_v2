---
kind: suite-flakes-under-load
lesson: Run the gates at a capped worker count while Foundry runs, and name a flake's cause before trusting a green. Under load, read the failure messages and rerun with `--testTimeout=30000 --hookTimeout=30000` before believing a red; CI on a quiet machine gives the verdict.
landed: memory:feedback-suite-flakes-under-load.md
---
**Mechanism:** With Foundry, the debug Chrome and a CDP poller running, the full suite failed 24 or 25 tests in files the branch never touched: 5 s timeouts and test-world setup errors. Each file passed alone and the suite passed at four workers. The cause is unproven; a test world reading a global another file's world is still tearing down would explain the socket error.
**Lesson:** While Foundry runs, run the gates with `npx vitest run --maxWorkers=4 --minWorkers=1`, and say so in the report. A green at four workers is not a cause: the flake stays open until its cause is named. Under load, read the failure messages and rerun with `--testTimeout=30000 --hookTimeout=30000` before believing a red; CI on a quiet machine gives the verdict.
**Surprises:** [2026-10-19-suite-flaked-under-load](../2026-10-19-suite-flaked-under-load.md) · [2026-10-29-suite-red-beside-live-foundry](../2026-10-29-suite-red-beside-live-foundry.md) · [2026-11-06-suite-timeouts-at-ninety-percent-cpu](../2026-11-06-suite-timeouts-at-ninety-percent-cpu.md)
