---
id: 2026-11-12-fallen-dossier-showed-banked-intel
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** A fallen Unit's Dossier is read-only with nothing to spend (FA.frozen).
**Actual:** It printed the Intel banked on it.
**Cause:** `module/apps/intel-window.mjs:233 @ ff34220` — the held line ignored the fall.
**Fix:** `module/apps/intel-window.mjs:233 @ ff34220` — no held line, Intel 0, when fallen.
