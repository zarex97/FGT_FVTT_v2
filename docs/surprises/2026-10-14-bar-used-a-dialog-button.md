---
id: 2026-10-14-bar-used-a-dialog-button
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Player1 pressing Wisdom of Dún Scáith on the action bar gets the sheet's answer: the GM opens that list.
**Actual:** The press spent a Servant move ("Servant moves 1 / 4") and posted a card "Wisdom of Dún Scáith A+ — No effect".
**Cause:** `module/apps/hud/action-bar.mjs:500 @ 4983091` — the bar sent every non-attack, non-mode ability to `useSkill`; only the sheet's `#onOpenDialog` knew an `opensDialog` ability is a setup list.
**Fix:** `module/apps/actor-sheet/sheet.mjs @ cde0483` — one `openAbilityDialog` door for the sheet and the bar, and `engine/skill-use.mjs#useSkill` refuses an `opensDialog` ability.
