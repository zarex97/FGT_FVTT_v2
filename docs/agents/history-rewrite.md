# Rewriting a repository's history

On 2026-11-06 this repository's history and eleven of the owner's others were rewritten to remove AI-tool
credits (ADR-0007). Commit IDs changed, and file contents did not. This page is how to catch up a clone, and how to run the same
rewrite on another repository.

## Catching up a clone made before the rewrite

Do not `git pull`: old and new history share no commit, so a merge would bring the old history back. The
simplest route is a fresh clone. A clone holding work that was never pushed moves its branches instead:

```sh
git fetch origin --force --tags --prune '+refs/heads/*:refs/remotes/origin/*'
git rebase --onto origin/<branch> <old-id-of-the-branch-point> <your-branch>
```

The old-to-new ID map came out of `git-filter-repo` as `commit-map`. It is kept beside the backup bundle
in `~/history-rewrite-backups` on the PC. The PC's worktrees and the VPS clone are already moved. An ID in
a report written outside this repository may be an old one: the map translates it.

## Running it on another repository

1. Back up every ref, the pull refs too: `git clone --mirror`, then `git bundle create <file> --all` into a folder outside the clone.
2. Rewrite a `git clone --bare`, which holds branches and tags and no pull refs. `git-filter-repo` with `--mailmap`, `--message-callback` and `--prune-empty never --prune-degenerate never`, so no commit is dropped.
3. Check against the mirror, commit by commit through `commit-map`: same tree, same parents, same dates. Search the new messages for what should be gone and read each hit: a sentence naming `claude.ai/code` is not a credit.
4. Switch off whatever a push sets off: Actions, and any host that deploys from a branch. Railway's documented auto-deploy switch is on the dashboard, and its CLI has none. A force-push does start a Railway deployment: on 2026-11-06, six services rebuilt and came back `SUCCESS`, and two were `SKIPPED` with *"No changes to watched files"*, which leaves the live deployment running. Skipped is not failed.
5. Force-push branches and tags with `--atomic` and `--force-with-lease=<ref>:<old-id>` for each ref, so a ref that moved since the backup refuses the push.
6. Leave Actions off until GitHub has drained the push. The runs are created after the push returns, not during it. Switch them back on only when no new run has appeared for some minutes, then cancel any run that landed.
7. Move every other clone's branches through `commit-map`, after fetching: a ref cannot point at a commit not yet in the clone.
8. Check the result: `gh api repos/<owner>/<repo>/contributors`, and a fresh clone's author, committer and message search.

`refs/pull/*` cannot be rewritten: GitHub keeps the old commits behind every pull request until its
Support removes them. The contributor listing counts the default branch, so it does not wait on them. A
rewrite does not touch pull request descriptions either: those are edited one by one through the API.
