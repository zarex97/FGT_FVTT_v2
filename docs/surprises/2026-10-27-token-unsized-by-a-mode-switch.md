---
id: 2026-10-27-token-unsized-by-a-mode-switch
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Fafnir ended by his own switch shrinks to 1x1 on the middle panel, as the upkeep's end did.
**Actual:** Footprint 1x1, token still 3x3 at (6,5).
**Cause:** `module/engine/token-footprint.mjs:40 @ 6ef9ce96` — the size sync hears actor and effect writes only; the owner's switch writes the item alone, and the derived footprint changed with nothing heard.
**Fix:** `module/engine/token-footprint.mjs:62 @ uncommitted` — the sync hears an item's `active` switch. Re-pressed live: 1x1 at (7,6).
