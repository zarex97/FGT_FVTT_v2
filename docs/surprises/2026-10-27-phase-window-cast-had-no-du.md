---
id: 2026-10-27-phase-window-cast-had-no-du
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** Knacken picked at the start of his attacking Phase lands on that Phase's DU (`windowTarget: defender`).
**Actual:** *"Straße/gehen: Knacken cannot be used: Choose a target.."*
**Cause:** `module/engine/attack.mjs:323 @ 6ef9ce96` — the attacker's Phase window opens before any Process exists and was handed `{attackerId}` alone; my `windowPlacement` read a `defenderId` that was never there. The unit test scanned the placement, not the declaration.
**Fix:** `module/engine/attack.mjs:324 @ ab3d28a9` — the declaration hands its single DU to the window.
