---
kind: source-scan-pins-text
lesson: A test that reads source text matches a stable marker, or tests the behaviour; it never pins an exact line of code.
landed: none
---
**Mechanism:** A test reads an engine file as text and matches an exact line of it. A new option or a third call to the same function breaks it while the behaviour is unchanged, and the failure reads like a regression.
**Lesson:** Prefer a behaviour test through the arena. When only a source scan will do, match a stable marker (a named function, a comment tag), and name in the test what it guards. Its sibling, `source-scan-assumes-linux-checkout`, covers line endings and path separators.
**Surprises:** [2026-10-16-source-scans-pinned-the-rider-lines](../2026-10-16-source-scans-pinned-the-rider-lines.md)
