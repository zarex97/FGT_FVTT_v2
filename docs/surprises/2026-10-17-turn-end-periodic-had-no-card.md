---
id: 2026-10-17-turn-end-periodic-had-no-card
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Curse's damage at the end of its bearer's Turn is a line a player reads, as a Round's Poison is.
**Actual:** Van Gogh and Medea each lost 125 to Curse at the end of Faction 1's Turn; the only card was "Master of Lancer of Faction 2 loses 20 Health".
**Cause:** `module/engine/scheduler-hooks.mjs:453 @ 8d1c012f` — `postPeriodicReport` was called at the Round's end only; the Turn's end applied its periodic ticks and said nothing.
**Fix:** `module/engine/scheduler-hooks.mjs` @ uncommitted — the Turn's end posts it too, titled "End of the Turn", the effect by its name ("Curse", not "curse").
