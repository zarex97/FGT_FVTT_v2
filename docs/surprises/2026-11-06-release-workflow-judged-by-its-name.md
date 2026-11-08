---
id: 2026-11-06-release-workflow-judged-by-its-name
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** I told the owner in a grill pick that `isaacsHBPF2e`'s `release.yml` "only runs on `v*` tags", so a commit on its `main` would start nothing.
**Actual:** It runs on every branch push, on pull requests and on published releases. PR 148 started it. Only its `release` job is limited, to published releases, so no release ran.
**Cause:** `isaacsHBPF2e/.github/workflows/release.yml:4 @ f281f5a` — I carried over what `FGT_FVTT_v2`'s `release.yml` does, because the two files share a name, and never read this one. The owner's pick rested on that line.
**Fix:** `docs/surprises/2026-11-06-release-workflow-judged-by-its-name.md:9 @ e90b410` — the claim is taken back to the owner in the same turn. Its Actions were off for the force-push anyway, and the owner has no decision left that rests on it.
