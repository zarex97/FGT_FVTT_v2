# History carries no AI-tool credit

The owner decided that this repository's history and its GitHub contributor list should name only the
owner. They used to name Claude as well: 72 commits were authored by `Claude <noreply@anthropic.com>`,
1207 carried a `Co-Authored-By` trailer and 1130 a `Claude-Session` link. GitHub lists a contributor by the
author email on the default branch, so `claude` stood beside the owner with 64 contributions.

So on 2026-11-06 every branch and tag was rewritten. The authored commits now carry the owner's noreply
identity, and both kinds of line are gone from every message. Trees, parents and dates are unchanged,
checked commit by commit. Every commit ID changed, because Claude authored the root commit. The IDs cited
in the tree were swapped in one follow-up commit; the IDs in older versions of those files stay as written.

This records what the metadata says, and it does not change how the project works: the code is still
written with Claude Code, which `CLAUDE.md` and `.claude/` say openly.

New credit is stopped at its source: the `attribution` setting, on each machine, written by the cloud
environment's setup script and committed in `.claude/settings.json`, and the Git identity set in the cloud
environment (`docs/agents/cloud.md`).

## Considered options

**Stop new credit and leave history alone.** No IDs change and nothing breaks. Rejected because `claude`
would stay listed for good: GitHub offers no other way off the list, and it does not read `.mailmap`.

**Clean the messages and keep the authors.** Rejected for the same reason: the listing reads the author.

**ByeClaude.** The owner proposed this purpose-built tool. Its docs cover the same ground, and it was used
as a second, read-only check through `verify`. `git-filter-repo` did the rewrite because it also updates
the IDs cited in commit messages, 88 of which do, and ByeClaude is a prerelease whose author says it has
not run on a real Claude Code history.

## Consequences

Every clone made before the rewrite must be replaced or moved (`docs/agents/history-rewrite.md`). A commit
ID quoted outside this repository no longer resolves in a fresh clone. GitHub keeps the old commits behind
`refs/pull/*`, where they are still public, until its Support removes them, if it does. The merge commits
GitHub signed lost their signatures, 89 of them. A backup bundle of the old history is kept on the PC.
