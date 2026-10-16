---
id: 2026-10-16-branch-switched-under-another-session
found: tooling
kind: shared-working-copy
status: fixed
reviewed: true
pattern: shared-working-copy
---
**Expected:** the working copy was this session's alone. The start-of-session status showed two
edited Character Sheets on `claude/emiya-open-208`, so `git checkout -b claude/hundred-face-clauses`
looked like it moved only the user's sheet edits onto a fresh branch for the Hundred-Faced Hassan
Clause list.

**Actual:** another session was working in the same directory on `claude/emiya-open-208`. Before the
commit, `git status` showed 25 changed files that were not this session's (`module/engine/attack.mjs`,
`module/engine/shield.mjs`, `test/unit/emiya-208-open.test.mjs`, a second hunk in
`docs/D-servant-data-sheets.md`, …). The checkout had moved `HEAD` under that session, so its next
commit would land on `claude/hundred-face-clauses`. Pointing `HEAD` back and committing through a
private index was refused by the permission check (*"Modify Shared Resources"*).

**Cause:** `.git/HEAD @ cf20cfc` — a branch is one per working copy, not one per session. Two sessions
in one directory share `HEAD`, the index and every file, and nothing warns either of them.

**Fix:** `.git/worktrees/FGT_FVTT_v2-hassan @ cf20cfc` — the user chose a separate worktree. The
main working copy went back to `claude/emiya-open-208` (same commit, so no file moved), and
`claude/hundred-face-clauses` was checked out in `../FGT_FVTT_v2-hassan` with only this session's
files carried over. "Work in another branch" means its own worktree whenever another session may
be live in the directory.
