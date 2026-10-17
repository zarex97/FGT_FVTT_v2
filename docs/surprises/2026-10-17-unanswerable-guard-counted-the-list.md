---
id: 2026-10-17-unanswerable-guard-counted-the-list
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Kiritsugu's shot refuses Block, Evade and Counter, so its rung needs nobody and the shot lands
*"instantly"*, before the Attack it answers (#243 reading 7).
**Actual:** The shot's Process sat at `react`, waiting on its defender to press "Do nothing", the one button the card
drew; the attacker at 1 Health kept its Attack.
**Cause:** `module/engine/combat-process.mjs:381 @ a27e058f` asked `options.length === 0` of the three standing rungs,
which never filters `forbiddenReactions`; the card (`cards.mjs#promptOptions`) does. Two readers of "what is left on
this rung", one of them dead.
**Fix:** `module/engine/combat-process.mjs:390 @ 5101f86f` asks what is left after `forbiddenReactions`: only "Do
nothing" and no ability is no question.
