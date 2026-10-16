---
id: 2026-10-16-boundary-lost-during-migration
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** after `node tools/fgt-reload.mjs` reported "World ready", the GM's `nextTurn` from Faction 2 to Faction 1 runs one boundary: `globalTurn` 7 -> 8, a fresh Turn budget for Faction 1.
**Actual:** Foundry's turn moved and `globalTurn` stayed 7. Faction 1's tracker read "Servant attacks 2/2" before it attacked; `scheduleClaim.turn` still "r3t0". The open §46.4-JY / `2026-10-11-boundaries-skipped-after-reload` shape, reproduced.
**Cause:** `module/fgt.mjs:255 @ b4464ed` — `ready` awaits `migrateOnReady()` (content-sync reads the packs, seconds) BEFORE `attachEngineListeners()`, while `game.ready` is already true. A Turn changed in that window fired `combatTurnChange` with no listener bound, and nothing ever ran it.
**Fix:** `module/engine/engine-ready.mjs @ 9d0ab57` — `Scheduler.attachBoundaries()` binds the Turn and Round hooks first thing in `ready`; `onTurnChange` captures what it reads synchronously, then awaits `whenEngineReady()`, which `attachEngineListeners` resolves. `test/unit/engine-ready.test.mjs`; live check: reload, `nextTurn` at once.
