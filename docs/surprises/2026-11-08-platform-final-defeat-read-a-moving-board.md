---
id: 2026-11-08-platform-final-defeat-read-a-moving-board
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** GKM's fall runs its `finalDefeat` rule and sets Avicebron's Construction to 0, as the unit test showed (#394 ruling 3).
**Actual:** Construction stayed at 50 three times. The first time, `noteFinalDefeat` found no actor and returned. The second time, the rule fired but only logged: `ownerOnBoard: false`. Once the fix used the board from before the defeat, Fig Tree's card read *"quUhXsOwm2mY8Edj regains 100 Health … hzZoECxRC8Ex5lS4 regains 400 Health"*. Those were the Golems and GKM, which had already left.
**Cause:** `module/engine/io.mjs:757 @ dda17e6`: `destroyPlatform` deletes a platform's actor before the rule runs. `currentBoard()` is built from canvas placeables, and the teardown had just moved the rider off the deleted level, so the subject `owner` found nobody. A board kept from before the defeat still held every Unit that left with it. The test world deletes no actor and draws no canvas, so it passed.
**Fix:** `module/engine/io.mjs:1942 @ 5e770cb`, `module/engine/applier.mjs:1273 @ 5e770cb`: the applier keeps the board from before the defeat. `fireFinalDefeat` runs on the fallen Unit and that board, less every Unit whose document is gone.
