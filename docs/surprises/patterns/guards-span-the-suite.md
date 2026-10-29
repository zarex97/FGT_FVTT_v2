---
kind: guards-span-the-suite
lesson: Before a commit, run the full suite at four workers, lint and validate:content; a new piece is guarded by tests far from its own file.
landed: CLAUDE.md#Lessons
---
**Mechanism:** The repo guards each kind of piece with a test that lives beside the kind, not beside the feature: the
one door every effect lands by, the ceiling on hand-built subjects, the frozen list of Count kinds, the docs that go
with a commit. A feature's own test file proves it works and none of those. Karl's first stage was committed on its
own tests passing and three guards failed afterwards.
**Lesson:** Before any commit, run the full suite at four workers (`--poolOptions.forks.maxForks=4`), `npm run lint`
and `npm run validate:content`, and change the docs chapter the work touches. A green feature file is not a green build.
**Surprises:** [2026-10-29-committed-before-full-suite](../2026-10-29-committed-before-full-suite.md)
