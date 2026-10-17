---
kind: shared-working-copy
lesson: Work in the main checkout on a branch, so Foundry runs what you build; before blaming a red test or committing, check git status for files that are not yours.
landed: CLAUDE.md#Lessons, memory:feedback-shared-working-copy.md
---
**Mechanism:** Two Claude sessions in one directory share `HEAD`, the index and every file, and nothing warns either. A `git checkout -b` moved the other session's next commit onto this session's branch, and the other session's untracked sheet turned this session's suite red.
**Lesson:** Work in the main checkout, on a branch of your own. Before calling a red test this change's, or committing, run `git status` and name the files that are not yours.
**Overturned 2026-10-17 (the user):** the worktree half. A worktree per build meant pointing Foundry's `fgt` junction at it, building its packs and styles, and stashing the user's own edits in the main checkout to pull the merge back; and the collision it guarded against only happened because the user had opened two sessions on the repo at once. The `git status` half stays, for that case.
**Surprises:** [2026-10-16-branch-switched-under-another-session](../2026-10-16-branch-switched-under-another-session.md) · [2026-10-16-suite-red-from-another-sessions-files](../2026-10-16-suite-red-from-another-sessions-files.md)
