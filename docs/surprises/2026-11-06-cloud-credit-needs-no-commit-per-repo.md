---
id: 2026-11-06-cloud-credit-needs-no-commit-per-repo
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** I told the owner that cloud sessions on other repositories keep the trailer until `attribution` is committed in each one, and `docs/agents/cloud.md` said the same. That meant 59 commits, 19 of them on repositories that deploy on a push.
**Actual:** The owner asked whether a general setting could do it. A setup script that writes `~/.claude/settings.json` and `~/.claude/CLAUDE.md` in the container gave a clean commit in `To-Do-App`, which has no `.claude/`, and the session was handed no attribution lines. No session ran without the script, so which step removed them is inferred.
**Cause:** `docs/agents/cloud.md:36 @ 46c67473` — I read "user settings are not read" as a rule about the session, when the docs give the reason that the file stays on the PC. I never read the page's section on what a setup script can write in the container.
**Fix:** `tools/cloud/setup.sh:199 @ uncommitted` — the script writes both files, for every repository the environment opens.
