---
id: 2026-10-23-fields-drawn-for-the-gm-only
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Player1, having marked out Wallachia (#330, WL.name "shown on the board"), sees the 9x9 on the board.
**Actual:** the card read "Vlad III (Lancer) marks out Wallachia." and Player1's board showed no area. The Region
existed (81 panels, rows 0-8, columns 2-10) with `visibility: 4`, `LAYER_UNLOCKED`: the GM's Regions layer only.
**Cause:** `module/engine/fields.mjs:445 @ 630495df` creates every field's Region with no `visibility`, Foundry's
default; Home Bases set `ALWAYS` (`war-setup.mjs:153`). No field has been drawn for a player since fields existed.
**Fix:** `module/engine/fields.mjs#fieldVisibility @ uncommitted` — the user ruled every field drawn for players
(2026-10-24): `openField` draws each at `ALWAYS`, `ensurePassiveFields` shows one that stood hidden, and the
`shown` key is gone.
