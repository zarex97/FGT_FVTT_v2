---
id: 2026-10-23-copy-dialog-titled-scathach
found: live press
kind: sheet-binds-only-its-owner
status: fixed
reviewed: true
pattern: sheet-binds-only-its-owner
---
**Expected:** Chiron's copy pick, opened on the GM's screen when his token entered the War, names his Skill.
**Actual:** the GM's window and the player's prompt both read *"Wisdom of Dún Scáith"*.
**Cause:** `module/apps/copy-dialog.mjs:32 @ 706f5fde`: the window title and `askOwner`'s prompt title were the lang
strings `FGT.Copy.Title` and `FGT.Copy.PickTitle`, both Scáthach's Skill's name, in the dialog every copy grant shares.
Same mechanism as `2026-10-23-copy-grant-hard-coded-scathach`.
**Fix:** `module/apps/copy-dialog.mjs#title @ 28e231ce`: the window and the prompt take the grant's own name.
`chiron-326.test.mjs` "the copy dialog names its own grant" red first.
