---
id: 2026-10-14-unit-view-assumed-three-turns-a-round
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** a projected Unit counts a ◈ lock or sustainability in the world's own Round length, as the board does.
**Actual:** in a world at eight Turns a Round, Mad Enhancement's 2◈ toggle lock read unlocked ten Turns after the toggle. 2◈ is sixteen Turns there; the Unit view counted six.
**Cause:** `module/engine/board.mjs:86 @ 46d0edc` — `unitSnapshot` never passed `turnsPerRound` to `snapshotUnit`, which defaults it to 3 (`module/rules/snapshot.mjs:64`). `snapshotBoard` passed it to the board, so the board and its Units disagreed.
**Fix:** `module/engine/board.mjs @ 26d95f4` — `unitSnapshot` passes the world setting. `test/unit/unit-view-round-length.test.mjs` fails with the line removed.
