---
id: 2026-10-11-end-verdict-raw-reason
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** An active mode that cannot be switched off says why in words, as the sheet's toggle does.
**Actual:** Mad Enhancement's slot read "Mad Enhancement — toggleLock".
**Cause:** `module/apps/hud/action-bar.mjs:697 @ uncommitted` — my `endVerdict` handed `canToggleMode`'s reason id to the use gate's refusal mapping, which knows only `FGT.Ability.Refused.*`. Three of its reasons had no `FGT.Mode.*` text either.
**Fix:** `module/apps/hud/action-bar.mjs @ uncommitted` — `endVerdict` formats `FGT.Mode.<reason>` and the slot shows it. `forced`, `suspended` and `oncePerRound` got their text. A test checks every reason has one.
