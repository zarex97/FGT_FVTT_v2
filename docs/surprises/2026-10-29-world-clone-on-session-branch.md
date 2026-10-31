---
id: 2026-10-29-world-clone-on-session-branch
found: tooling
kind: assumed-shape
status: fixed
reviewed: true
pattern: drive-kit
---
**Expected:** `docs/agents/cloud.md`: `fvtt-world pull` "clones or updates `/home/user/fgt-worlds`" and unpacks
`fgt2026.tgz`; the clone was assumed to sit on `main`, tracking `origin/main`.
**Actual:** on the first audit run in a cloud session the harness had cloned `zarex97/fgt-worlds` onto the session's
own branch (`ccr-8ef89516-n8qvw5`) with no upstream, and `fvtt-world pull` stopped at "There is no tracking information
for the current branch". No world was copied.
**Cause:** `tools/cloud/setup.sh:139 @ 03883e1` — `sync_clone` ran a bare `git pull --ff-only`, which needs an
upstream; the clone's shape was the harness's, never read. `push` has the same shape: `git push origin HEAD` sends the
commit to the session branch, not to the `main` the PC pulls.
**Fix:** `tools/cloud/setup.sh:142 @ 1c5ffff` — `sync_clone` fetches `origin main` and `pull` reads the archive
with `git show origin/main:<world>.tgz`, whatever is checked out; `cloud.md` says where `push` lands.
