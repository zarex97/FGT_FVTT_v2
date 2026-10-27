---
id: 2026-10-27-stance-scan-pinned-the-window-call
found: test
kind: source-scan-pins-text
status: fixed
reviewed: false
---
**Expected:** Handing the Phase window its DU leaves Achilles's stance test green.
**Actual:** *"AssertionError: expected 18670 to be less than -1"*: the scan's `indexOf` found no window call.
**Cause:** `test/unit/achilles.test.mjs:813 @ 6ef9ce96` — the scan pinned the whole call, `{ attackerId }, COMBAT_PHASE_START_WINDOW, null);`, so adding a `defenderId` hid it.
**Fix:** `test/unit/achilles.test.mjs:814 @ uncommitted` — the scan finds the call by its marker, `: await offerAttackerWindow({ attackerId,`.
