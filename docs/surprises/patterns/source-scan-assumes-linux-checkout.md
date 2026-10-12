---
kind: source-scan-assumes-linux-checkout
lesson: A test that reads source text normalises CRLF and backslash paths before it matches anything.
landed: none
---
**Mechanism:** A test reads source files as text and matches lines and paths. On a Windows checkout every line ends in `\r` and every path uses `\`, so a comment-stripping regex keeps the comment and a path skip never matches: the test fails on the PC and passes on the VPS.
**Lesson:** Split on `/\r?\n/`, replace `\r\n` before a multi-line regex, and turn `\` into `/` before matching a path. Ch. 44's traps section carries it.
**Surprises:** [2026-10-12-source-scan-test-fails-on-windows](../2026-10-12-source-scan-test-fails-on-windows.md)
