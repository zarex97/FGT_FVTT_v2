---
id: 2026-10-15-process-end-fan-out-pays-twice
found: test
kind: check-then-act-race
status: fixed
reviewed: false
---
**Expected:** with the Circuits' "next NP" moved to `combatProcessEnd`, Overedge's two swings spend its one charge once:
Luck +2.

**Actual:** (an experiment with the fix switched off) Luck +4 for the NP, 9 where the test wants 7. Two Processes of one
declaration reach their end together; each reads the board before the other's batch lands, both see the charge, both
pay.

**Cause:** `module/engine/attack.mjs:1845 @ 7231295` — `fireCombatProcessEnd` decided from `currentBoard()` and applied
later, with nothing between two Processes of one attacker. The same shape as the Damage Step window (§46.4, 2026-10-12).

**Fix:** `module/engine/attack.mjs:1845 @ d9a77c1` — firings queue per attacker, so the second reads the board the
first left. `emiya-208-arena.test.mjs` "Overedge's two swings spend the charge once" is red without it.
