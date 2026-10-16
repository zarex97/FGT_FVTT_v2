---
id: 2026-10-16-summon-item-granted-to-nobody
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** the war wizard's "Avalon (on an 8)" line came up 8, so Arturia arrives holding [Avalon] (#230 reading 14).
**Actual:** the war built and her items listed no `avalon`; nothing on screen said why.
**Cause:** `module/engine/summon.mjs:236 @ 9d0ab57` — the grant went through the `itemGrant` intent, whose applier asks `acquisitionTarget` of the Unit on the board; `commitSummon` runs before the war places her token, so the board held nobody and the grant was refused with a console warning only. The unit test passed: it granted to a Unit already standing.
**Fix:** `module/engine/summon.mjs:236 @ 9d0ab57` — a Servant's own starting Item is written straight onto her (`io.grantItem`): she arrives with it, which is no acquisition to redirect.
