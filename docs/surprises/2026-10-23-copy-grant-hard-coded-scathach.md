---
id: 2026-10-23-copy-grant-hard-coded-scathach
found: test
kind: sheet-binds-only-its-owner
status: fixed
reviewed: false
---
**Expected:** Chiron's Wisdom of Divine Gift copies three Skills through the copy grant Scáthach's Wisdom of Dún
Scáith built, its Rank and clock its own.
**Actual:** `grantCopies` refused his third pick, `tooManyPicks`: the slot count defaulted to two, and every copy took
Dún Scáith's Rank, clock and exclusion set from constants.
**Cause:** `module/engine/copy.mjs:24 @ 706f5fde`: `DUN_SCAITH` and `slots = 2` in the shared reader were one sheet's
figures; the dialog repeated the default.
**Fix:** `module/engine/copy.mjs#copyGrantSpec @ 28e231ce`: each grant states `copyGrant {slots, cooldown,
exclusionSet}` and the copies take its Rank; the dialog and `grantCopies` read it. Scáthach's file states her two.
`chiron-326.test.mjs` (WD*) red first.
