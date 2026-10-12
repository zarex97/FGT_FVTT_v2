---
kind: failure-dismissed-unread
lesson: Before calling a failing test pre-existing, read its diff and name the cause.
landed: memory:feedback-failure-dismissed-unread.md
---
**Mechanism:** A failing test was carried through two audits as "pre-existing, not mine" without its diff being read. Read, the cause was the checkout, not the code, and a two-line fix.
**Lesson:** Before reporting a failure as pre-existing, read its diff and name the cause in one sentence. A failure with no named cause is unexplained, not pre-existing.
**Surprises:** [2026-10-12-source-scan-test-fails-on-windows](../2026-10-12-source-scan-test-fails-on-windows.md)
