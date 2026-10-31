---
id: 2026-10-29-cloud-setup-script-not-run
found: tooling
kind: environment-not-provisioned
status: open
reviewed: true
pattern: drive-kit
---
**Expected:** the brief: the cloud environment's setup script installed Node 24 at `/opt/node24` and the commands `fvtt-up` and `fvtt-down`.
**Actual:** none of `/opt/node24`, `/usr/local/bin/fvtt-up`, `/usr/local/bin/fvtt-down` or `/opt/fvtt` existed in the session; no log named a failing command. `foundry_license` was set.
**Cause:** not found — the script lives in the environment's settings, outside the repo, so nothing in the session shows whether it ran.
**Fix:** open — `tools/cloud/setup.sh:1 @ 1de4229` puts the script in the repo; it is pasted into the environment's Setup script by the user, and the next session shows whether `fvtt-up` is present.
