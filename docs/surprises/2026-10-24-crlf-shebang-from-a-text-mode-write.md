---
id: 2026-10-24-crlf-shebang-from-a-text-mode-write
found: test
kind: source-scan-assumes-linux-checkout
status: fixed
reviewed: true
pattern: source-scan-assumes-linux-checkout
---
**Expected:** `public-names-235.test.mjs` runs the new `speakerlessCards` cases.
**Actual:** `SyntaxError: Invalid or unexpected token`, no tests, with `node tools/check-public-names.mjs` running fine.
**Cause:** `tools/check-public-names.mjs:1 @ b73ee90a` was rewritten by a Python text-mode write on Windows, which
wrote every line CRLF, and Vite cannot import a `#!/usr/bin/env node` shebang (#239's trap, again).
**Fix:** `tools/check-public-names.mjs @ uncommitted` written back LF; an edit to a `tools/*.mjs` goes through Edit or
a binary write.
