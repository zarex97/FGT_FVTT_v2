---
id: 2026-10-29-create-world-moved-to-create
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** a throwaway world is created by `POST /setup` with `{action: "createWorld"}`, beside `launchWorld`.
**Actual:** `/setup` answered `"Unsupported setup configuration action createWorld provided"`, and the launch after it `"The requested world fgt-cloud-smoke does not exist!"`.
**Cause:** `app/dist/server/views/create.mjs:1 @ 9fec0f2` (foundryVTT_copy) — v14 moved world creation to its own view at `/create`; `setup.mjs` keeps `launchWorld` and `editWorld` only.
**Fix:** `docs/agents/cloud.md:39 @ 1de4229` — the cloud doc names `POST /create` with `{action: "createWorld", id, title, system}`; the world was created and launched that way.
