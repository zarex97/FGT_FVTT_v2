---
id: 2026-10-29-fgt-world-cloud-root-chromium
found: tooling
kind: assumed-shape
status: fixed
reviewed: true
pattern: drive-kit
---
**Expected:** `docs/agents/cloud.md`: `tools/fgt-world.mjs` "takes Linux for the VPS"; with
`FGT_CHROME_EXE=/opt/pw-browsers/chromium` its `chrome:start`, `status`, `launch`, `join` and `rebuild` would work in
a cloud session, only `app:*` needing `fvtt-up` / `fvtt-down`.
**Actual:** `chrome:start` printed "FGT | Debug Chrome started." and `status` then said `"debugChrome": "not
reachable"` and `"foundryApp": "stopped"` with Foundry up on :30000. Run by hand, Chromium said "Running as root
without --no-sandbox is not supported."
**Cause:** `tools/fgt-world.mjs:409 @ 03883e1` — the VPS runs the browser as a user, a cloud session as root, and
`chromeStart` passed no `--no-sandbox` and returned in silence when the port never answered;
`tools/fgt-world.mjs:369 @ 03883e1` — `appRunning` asked `systemctl` for a `foundry` unit the container does not have.
**Fix:** `tools/fgt-world.mjs:418 @ 1c5ffff` — `--no-sandbox` when run as root, and `chromeStart` throws when the
port stays silent; in a cloud session (`/usr/local/bin/fvtt-up` present) `appRunning` probes :30000 and `app:*` refuse,
naming `fvtt-up` / `fvtt-down`. Then `chrome:start`, `status`, `launch`, `join` and `rebuild` all ran (rebuild 34 s).
