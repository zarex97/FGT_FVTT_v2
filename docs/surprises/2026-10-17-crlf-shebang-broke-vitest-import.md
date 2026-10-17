---
id: 2026-10-17-crlf-shebang-broke-vitest-import
found: test
kind: source-scan-assumes-linux-checkout
status: fixed
reviewed: true
pattern: source-scan-assumes-linux-checkout
---
**Expected:** `test/unit/public-names-235.test.mjs` passes on the PC as it did in CI and in the worktree it was built in.
**Actual:** `SyntaxError: Invalid or unexpected token` before any test ran, on the main checkout with my changes stashed too.
**Cause:** `tools/check-public-names.mjs:1 @ 8d1c012f` — the merge pull checked it out with CRLF (`core.autocrlf true`), and Vite's import of a `#!/usr/bin/env node\r` file failed; every older tool sits in the working copy as LF.
**Fix:** `.gitattributes` @ 05211bb1 — `tools/*.mjs text eol=lf`; the working copy renormalised.
