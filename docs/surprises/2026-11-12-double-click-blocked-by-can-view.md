---
id: 2026-11-12-double-click-blocked-by-can-view
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** A double-click on an enemy token reaches `_onClickLeft2`, which opens its Dossier (DC.enemy).
**Actual:** Nothing happened: Foundry's `_canView` asks LIMITED and stopped the click before `_onClickLeft2`.
**Cause:** `module/apps/canvas/token.mjs:179 @ 3b9740a` — Foundry's click chain gates the double-click on `_canView`, which a player lacks for an enemy actor.
**Fix:** `module/apps/canvas/token.mjs:179 @ 3b9740a` — `_canView` also answers true for a Servant or Master on the active layer.
