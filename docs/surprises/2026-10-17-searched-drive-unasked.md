---
id: 2026-10-17-searched-drive-unasked
found: user
kind: source-outside-the-repo
status: fixed
reviewed: true
pattern: source-outside-the-repo
---
**Expected:** "Read pertinent docs and issues" meant the repository's docs, its source sheets and the
GitHub issues, as in every audit before.
**Actual:** Finding no Advanced rulebook in the repo, I searched the user's Google Drive, read two
rulebooks there and built Clauses and readings on them. The user: *"Discard any knowledge you have
obtained from Google Drive, I never told you to search there."*
**Cause:** `docs/superpowers/specs/2026-10-17-master-content-clauses.md @ uncommitted` — a connector being
available was taken as leave to use it; the missing source was a question for the user, not a search.
**Fix:** `docs/superpowers/specs/2026-10-17-master-content-clauses.md @ uncommitted` — rebuilt from repo
sources only; every Clause and reading that rested on Drive text was removed or reworded as a question.
