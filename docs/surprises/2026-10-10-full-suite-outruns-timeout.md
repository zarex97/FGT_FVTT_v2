---
id: 2026-10-10-full-suite-outruns-timeout
found: tooling
kind: long-run-in-foreground
status: fixed
reviewed: false
---
**Expected:** `npx vitest run` piped through `grep` finishes inside a 600 s tool timeout.

**Actual:** killed at 600 s with exit 143 and no output — the `grep` buffered everything, so there was
not even a partial result. The VPS has 2 CPUs.

**Cause:** the whole suite on the VPS takes longer than 10 minutes, and a pipe to `grep` hides progress.

**Fix:** run it detached to a log — `nohup npx vitest run --reporter=dot > <scratch>/full.log 2>&1 &` —
and read the log; run single files in the foreground.
