---
id: 2026-10-22-opening-flip-never-written
found: retraction
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** a War opens on Day or Night at random. The rule reads *"When the game starts, Flip a Coin"*, and
the user restated it on 2026-10-22. `rules/environment.mjs#phase` alternates from that flip.

**Actual:** nothing in `module/` writes `MatchData.phase`. Its schema default is `"day"`, so every War opened on
Day and all its odd Rounds were Day. The `none` choice, *"playing without the Day-Night cycle"*, had no writer
either.

**Cause:** `module/data/misc.mjs:174 @ 8815e1de`. `phase` was declared with a reader in
`module/engine/board.mjs:498 @ 8815e1de`, and the setup path (`engine/war-setup.mjs#commitWar`) never wrote it.

**Fix:** `module/engine/war-setup.mjs#flipOpeningPhase @ c0e8ac9e`. `commitWar` flips `1d2` and says the
result on a card. The War Rule `dayNightCycle` switches the cycle off, read by `rules/environment.mjs#roundPhase`
(#314).
