---
id: 2026-10-12-source-scan-test-fails-on-windows
found: test
kind: source-scan-assumes-linux-checkout
status: fixed
reviewed: true
pattern: source-scan-assumes-linux-checkout, failure-dismissed-unread
---
**Expected:** `unit-view.test.mjs` fails on a real bare projection somewhere in `module/`. I had carried it through two audits as "pre-existing, not mine" without reading why.
**Actual:** it fails only on this Windows checkout. It flags `module/engine/skill-use.mjs`, where `unitSnapshot(actor)` sits inside a `//` comment, and `module/engine/board.mjs`, the one file it means to skip.
**Cause:** `test/unit/unit-view.test.mjs:38 @ 2a15982` — `code()` strips comments with `/\/\/.*$/`, and `.` stops at the `\r` of a CRLF checkout, so the comment survives. `test/unit/unit-view.test.mjs:44 @ 2a15982`: `file.endsWith("engine/board.mjs")` never matches a backslash path.
**Fix:** `test/unit/unit-view.test.mjs:46 @ 6d61cfd` — paths turned to `/` and lines split on `/\r?\n/`; `test/unit/raikou-195.test.mjs:123 @ 6d61cfd` — `\r\n` replaced before the multi-line match. A probe file with a real `unitSnapshot(` still fails the guard.
