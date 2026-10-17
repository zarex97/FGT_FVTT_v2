---
kind: source-scan-assumes-linux-checkout
lesson: A test that reads source text normalises CRLF and backslash paths before it matches anything.
landed: none
---
**Mechanism:** A test reads source files as text and matches lines and paths. On a Windows checkout every line ends in `\r` and every path uses `\`, so a comment-stripping regex keeps the comment and a path skip never matches: the test fails on the PC and passes on the VPS. A checkout is a shape too: a tool merged in by a pull came out CRLF, and Vite failed to import its `#!/usr/bin/env node` shebang (#239).
**Lesson:** Split on `/\r?\n/`, replace `\r\n` before a multi-line regex, and turn `\` into `/` before matching a path. Ch. 44's traps section carries it. `.gitattributes` pins `tools/*.mjs` to LF, which holds it without a habit.
**Surprises:** [2026-10-12-source-scan-test-fails-on-windows](../2026-10-12-source-scan-test-fails-on-windows.md) · [2026-10-17-crlf-shebang-broke-vitest-import](../2026-10-17-crlf-shebang-broke-vitest-import.md)
