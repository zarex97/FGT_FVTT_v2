---
kind: shared-working-copy
lesson: When another session may be live in a directory, work in your own worktree and never switch its branch; before blaming a red test, check git status for files that are not yours.
landed: CLAUDE.md#Lessons, memory:feedback-shared-working-copy.md
---
**Mechanism:** Two Claude sessions in one directory share `HEAD`, the index and every file, and nothing warns either. A `git checkout -b` moved the other session's next commit onto this session's branch, and the other session's untracked sheet turned this session's suite red.
**Lesson:** When another session may be live in the directory, make a worktree of your own (`git worktree add ../wt-<name> -b <branch>`) and work only there. Never switch, reset or commit in the shared one. Before calling a red test this change's, run `git status` and name the files that are not yours.
**Surprises:** [2026-10-16-branch-switched-under-another-session](../2026-10-16-branch-switched-under-another-session.md) · [2026-10-16-suite-red-from-another-sessions-files](../2026-10-16-suite-red-from-another-sessions-files.md)
