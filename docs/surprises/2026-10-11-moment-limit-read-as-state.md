---
id: 2026-10-11-moment-limit-read-as-state
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: false
---
**Expected:** Her Master at 26 pays the 25 upkeep and drops to 1, and Tenmōkaikai stays on until the next upkeep finds 25 or less.
**Actual:** One Turn End posted both "loses 25 Health (Goō Shōrai・Tenmōkaikai)" and "Goō Shōrai・Tenmōkaikai forcibly deactivated on Raikou: its Master's Health is at its limit."
**Cause:** `module/rules/modes.mjs:349 @ f15a3d1` — `forcedOffNow` reads every mode's `SetMode active:false whenValue` as a state that holds at any moment. That was ruled for Mad Enhancement (#190 reading 13). Tenmōkaikai's limit is a moment, "if her Master has 25 or less and would lose it".
**Fix:** `module/rules/modes.mjs:353 @ b9884b9` — only an action with `atAnyMoment: true` is read at any moment. Mad Enhancement states it. A test keeps Tenmōkaikai on at Master Health 1.
