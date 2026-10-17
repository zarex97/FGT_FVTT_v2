---
id: 2026-10-17-free-clock-carried-across-contracts
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** Two Scáthachs of one sheet, freed by the same death, start the same Free clock.
**Actual:** Live, Semiramis died and her two conquered Scáthachs went Free with 8 and 6 Turns. One had been Free
before and kept what was left of that clock through the Conquest.
**Cause:** `module/engine/io.mjs#setContract @ e2b42d22`: a Contract wrote the contract, the Master and the side,
never `sustainabilityRemaining`; the clock read at the next death was the old remainder. The text counts *"after
its Master is killed"*, once per death; the code counted once per Servant.
**Fix:** `module/engine/io.mjs#setContract @ b0313abf` clears it for a Free or Unbound Servant contracted again
(ruled 2026-10-17), keeping Hanging Gardens' +2◈ while they stand (`hgob.mjs#restartedClock`). Live: 5 Turns, then a
full 6 on the new Contract.
