---
kind: source-outside-the-repo
lesson: Sources stay in the repo; a connector being there is not leave to search it, so ask for a missing source. A sheet copied into the repo is a snapshot: compare it with its source before building.
landed: CLAUDE.md#Lessons, memory:feedback-sources-stay-in-the-repo.md
---
**Mechanism:** A rule source the work needs is missing from the repository, a connector (Google Drive, the web) is available, and its availability is read as permission. Clauses and readings then rest on text the user never chose to bring into the project. The other way round, a sheet brought in once is taken for the source ever after: 43 of the 48 repo sheets had drifted from Drive, some in rules, and the builds rested on the old text (2026-10-21).
**Lesson:** Rules come from the repository's docs, its source sheets and its issues. When one is missing, say which and ask the user for it; search a connector only when told to. A sheet copied into the repo is a snapshot of its source: it records where it came from and when, and is compared with that source before a build.
**Surprises:** [2026-10-17-searched-drive-unasked](../2026-10-17-searched-drive-unasked.md) · [2026-10-21-repo-sheets-differ-from-drive](../2026-10-21-repo-sheets-differ-from-drive.md)
