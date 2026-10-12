---
id: 2026-10-12-round-end-read-next-rounds-records
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** Serenity's Normal Attack lands on Heracles's Master in its Home Base in Round 9. At Round 9's end, E1's "unless it fought here" withholds the 100 Health.
**Actual:** the Master took 160 Poison and went 151 → 91: Home Base healed 100 first. Its `roundState` read `{round: 9, combatInBaseThisRound: true}`; `currentBoard({round: 9})` projected `combatInBaseThisRound: false`.
**Cause:** `module/engine/board.mjs:424 @ 50a76fe` — `currentBoard` spread its `round` override into the board settings only; each unit was projected by `unitSnapshot` at `currentRound()`, which a Round's end reads after `combat.round` has already moved on, so the ended Round's record read as stale.
**Fix:** `module/engine/board.mjs:427 @ 62aa8fc` — units are projected at the Round the caller names (`unitSnapshot(actor, token, {round})`).
