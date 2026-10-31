---
id: 2026-10-31-form-shrink-kept-top-left
found: live press
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** Ruling 26: leaving the Form she shrinks onto one of her four panels, her player's pick.
**Actual:** At the end of tick 24 she became 1x1 on her top-left panel, no prompt.
**Cause:** `module/engine/token-footprint.mjs:215 @ 7b1e3c86` — shrinking kept the top-left (Kingprotea's rule) for every non-centred Unit.
**Fix:** `module/engine/token-footprint.mjs:221`, `module/data/actor/servant.mjs:46`, `packs/_source/servants/summer-habetrot.yml:44 @ uncommitted` — `footprint.grows: cornerPick` and `pickedShrink`; pressed live at tick 30: 'Summer Habetrot shrinks', bottom-right picked, she stands on (11,9).
