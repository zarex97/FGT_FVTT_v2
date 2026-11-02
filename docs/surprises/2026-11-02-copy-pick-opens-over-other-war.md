---
id: 2026-11-02-copy-pick-opens-over-other-war
found: user
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** A copy pick owed in one War asks its GM on that War's board (#204 reading 8, #256: "redrawn once the War's scene is drawn").
**Actual:** The user: *"I am constantly seeing 'Wisdom of Divine Gift' that belongs (iirc) to another war."* Every reload of the GM's client opened Chiron's list over the Gray Audit, reading *"Open the War's scene to list what can be copied: this canvas does not hold the copier."* Chiron stands on Gilles Audit B, a War started at Round 61 whose pick was never made. Five Scáthachs on The Field owed picks too; under one fixed window id only one list could show.
**Cause:** `module/engine/copy.mjs:138 @ cc434eee` — the load walked `game.actors`, every pick owed in every War, while `offerCopies` asks the board. `module/apps/copy-dialog.mjs:28 @ cc434eee` — `id: "fgt-copy-dialog"` for every copier.
**Fix:** `module/engine/copy.mjs:142 @ uncommitted` — `owedPicksHere` reads the board drawn, as `offerCopies` does; load and every `canvasReady` open those on the War's GM and close a list whose copier is not on the board. `module/apps/copy-dialog.mjs:71 @ uncommitted` — one window per copier, brought forward when already open.
