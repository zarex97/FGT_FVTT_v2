---
id: 2026-11-12-intel-tool-missing-until-reset
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** The Intel tool registered on `getSceneControlButtons` appears in Token Controls on load.
**Actual:** Player1's Token Controls held no Intel tool until the controls were reset.
**Cause:** `module/fgt.mjs:336 @ 3b9740a` — Foundry builds the controls once at `ready`; a tool added after needs `ui.controls.render({reset: true})`, a plain render keeps the old set.
**Fix:** `module/fgt.mjs:336 @ 3b9740a` — renders with `reset: true` after attaching the tool.
