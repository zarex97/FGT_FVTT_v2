---
id: 2026-11-06-actions-back-on-before-push-events
found: tooling
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** With Actions switched off for the length of the force-push, none of its 103 ref updates would start a run.
**Actual:** I switched Actions back on as soon as `git push` returned. `gh run list` then showed `ci` runs queueing, 79 in the end. I cancelled them: 75 cancelled, 3 succeeded and 1 failed. No `release` run started, so no release was touched.
**Cause:** `.github/workflows/ci.yml:3 @ 22b477b` — every branch push starts `ci`, and GitHub creates the runs after the push returns, so the switch was back on before they were created. The pause covered the push, not the events it left behind.
**Fix:** `docs/agents/history-rewrite.md:28 @ 1c89ab6` — the procedure now leaves Actions off until no new run appears for some minutes, for the 11 repositories still to rewrite.
