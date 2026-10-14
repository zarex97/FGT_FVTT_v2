---
id: 2026-10-14-master-seen-units-silent-drop
found: test
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** turning the test world's movement hooks on changes no outcome, because `onMove`'s sighting pass only writes records each Unit keeps.
**Actual:** `riding-passenger.test.mjs` failed: `Actor(Master): write to "system.seenUnitIds" would be a Silent Drop — asked for ["karna"], Foundry kept undefined.`
**Cause:** `module/engine/vision.mjs:48 @ a9223aa` — `checkSightings` writes `system.seenUnitIds` for every seer on the board, and `module/data/actor/master.mjs:35` takes only `turnState`, `roundState` and `baseAttack` from `combatantCommon`. Live, Foundry pruned it on every move, so a Master "saw" the same Units for the first time each time. No test had run `onMove` before.
**Fix:** `module/engine/vision.mjs:50 @ 46d0edc` — a seer whose schema does not keep `seenUnitIds` is skipped. Only Semiramis's Doves, a Servant's, read first sightings.
