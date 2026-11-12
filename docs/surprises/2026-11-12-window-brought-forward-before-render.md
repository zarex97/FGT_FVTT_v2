---
id: 2026-11-12-window-brought-forward-before-render
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** `IntelWindow.open` renders and brings the window forward.
**Actual:** It threw: `bringToFront` ran before the element existed.
**Cause:** `module/apps/intel-window.mjs:64 @ 3b9740a` — `render` is async; the element exists only once it resolves.
**Fix:** `module/apps/intel-window.mjs:64 @ 3b9740a` — brings it forward after the render resolves, when the element exists.
