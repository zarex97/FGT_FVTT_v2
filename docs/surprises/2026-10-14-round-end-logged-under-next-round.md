---
id: 2026-10-14-round-end-logged-under-next-round
found: test
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** the game log files the end of Round 9 under Round 9.
**Actual:** played through a real Round boundary in the test world, the Round 9 `roundEnd` entry and the Turn-end poison tick were stamped `round: 10`, with `detail.round: 9`. The log viewer's Round filter showed them in Round 10.
**Cause:** `module/engine/game-log.mjs:35 @ 46d0edc` — `record` stamped `combat.round`, which Foundry has already advanced when the end-of-Round sequence runs.
**Fix:** `module/engine/game-log.mjs @ 26d95f4` — `record(fields, combat, at)` stamps the Moment it is given; `applyIntents({moment})` carries it to `io.log`, and the scheduler passes the ended Moment for every write of a boundary's end half.
