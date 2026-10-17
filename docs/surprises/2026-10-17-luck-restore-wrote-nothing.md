---
id: 2026-10-17-luck-restore-wrote-nothing
found: live press
kind: unknown-value-falls-to-default
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** Player1 pressed Lethal Gunfire Suppression at Luck 19/22: *"Restore 4 Luck"* makes it 22.
**Actual:** The card read *"Luck 19 (no change)"*; Luck stayed 19. Atk Up and Suppression landed.
**Cause:** `packs/_source/abilities/kiritsugu-lethal-gunfire-suppression.yml:29 @ a27e058f` named the pool `luck`, and
`module/engine/skill-use.mjs:770 @ a27e058f` passed a clamped change's key raw to `statDelta`; `io.mjs#adjustStat`
added 4 to `{value, max}` and wrote nothing usable, in silence. The unclamped path maps keys through `resourcePathFor`.
**Fix:** `module/engine/skill-use.mjs:774 @ 5101f86f` maps the clamped key through `resourcePathFor` too;
`module/engine/io.mjs:349 @ 5101f86f` refuses a non-number path out loud; the key is `luck.value`. A content test
walks every clamped restore.
