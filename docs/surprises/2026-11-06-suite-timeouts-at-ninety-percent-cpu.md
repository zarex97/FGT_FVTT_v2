---
id: 2026-11-06-suite-timeouts-at-ninety-percent-cpu
found: test
kind: suite-flakes-under-load
status: open
reviewed: true
pattern: suite-flakes-under-load
---
**Expected:** A docs-only branch passes at four workers, as the same suite did two hours earlier (8400 of 8400 in 190 s).
**Actual:** 59 failed in 1225 s, then 62 on the next run, in files the branch never touched: 42 of the 62 were `Test timed out in 5000ms`, and most others were `resolveAttack is not a function` and the like. Run alone at two workers they still failed.
**Cause:** `vitest.config.mjs:1 @ ecfcbbe` — no timeout is set, so tests get Vitest's 5 s, and a game held the CPU at 90%. Two failing files failed 14 of 24 at 5 s and none at 30 s, and the full suite at `--testTimeout=30000 --hookTimeout=30000` passed 8400 of 8400. A test that times out mid-setup leaves its later tests without their imports, which reads like a code bug. This is load on this one day: it does not prove the cause of `2026-10-19-suite-flaked-under-load`.
**Fix:** none in the code, so it stays open. Under load, read the failure messages and rerun with longer timeouts before believing a red suite, and let CI on a quiet machine give the verdict.
