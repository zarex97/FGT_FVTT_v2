---
id: 2026-11-13-expended-mode-switched-back-on
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** An expended ability is spent for the rest of the game: Lancelot's page *"does not reactivate"* after Arondight (MO.lancelot).
**Actual:** `canToggleMode` answered nothing about `expended`, so the bar's mode switch could turn a spent page back on; only the use gate (`rules/costs.mjs`) refused it.
**Cause:** `module/rules/modes.mjs:69 @ 6315e1e`: the mode switch is a second door beside the use gate, and it never asked the flag the use gate asks.
**Fix:** `module/rules/modes.mjs:73 @ 0d3920a`: refuses `expended` first, either way, with *"… can no longer be used for the rest of the game."*; test intel-405 MO.lancelot.
