---
id: 2026-11-01-plate-position-broke-window
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** The `plate` mixin, a two-pseudo-element metal edge with cut corners, would dress the actor sheet's window the way it dresses the bar and the cards. The window would stay where core put it, at `left: 16px`.
**Actual:** The sheet opened at x=780. `#interface` shrank from 1600px to 764px, so the chat sidebar slid into the middle of the screen and the action bar into the left half.
**Cause:** `styles/src/_ornament.scss:22 @ c504d31f`. The mixin set `position: relative`, which overrode core's absolute positioning on `.application`. The window then joined the body's flow beside `#interface`. I applied a mixin written for in-flow panels to a core window without reading how core places it.
**Fix:** `styles/src/_ornament.scss:22` and `styles/src/_shell.scss` @ c504d31f. The mixin takes `$position: null`, which leaves an element's own positioning alone, and the sheet's window passes it. Read live after the fix: `#interface` is 1600px and the sheet sits at x=16.
