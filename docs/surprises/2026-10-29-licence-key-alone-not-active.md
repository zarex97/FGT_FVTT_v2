---
id: 2026-10-29-licence-key-alone-not-active
found: tooling
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** the brief: `fvtt-up` "activates the licence from the env var foundry_license by POSTing to /license" — one POST.
**Actual:** the key POST answers 200 with "License key entered, please sign the End User License Agreement."; `/` still redirects to `/license` until a second POST signs the EULA.
**Cause:** `app/dist/server/views/license.mjs:1 @ 9fec0f2` (foundryVTT_copy) — `handlePost` steps `key` then `eula`, and only the `eula` step calls `license.sign()`; both steps read one session.
**Fix:** `tools/cloud/setup.sh:75 @ 1de4229` — `fvtt-up` sends both POSTs on one cookie jar, then exits 3 unless `/` lands on `/setup`, `/auth`, `/join` or `/game`.
