---
id: 2026-10-31-count-bonus-rounding-vs-grill
found: live press
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** My grill pick for #362 reading 18 said Rhongomyniad's *"increases by ½◈ for every criteria"* adds 2 Turns per criterion at 3 Turns a Round.
**Actual:** Five criteria set the clock to 23 (15 + 8), not 25: "Cooldown 23 → 18".
**Cause:** `module/engine/cooldown.mjs:271 @ fe7e8891` sums the fractions and rounds once over the whole (#283, Excalibur Proto: "four ½◈ are 2◈"). I wrote the figure without reading `countBonusTicks`.
**Fix:** `module/domain/tick.mjs#roundsToTicks @ 498eb1f4`: ruled 2026-11-01, sums convert once, rounded down and never to 0, and ½◈ at 3 Turns a Round is 1. Five criteria give 22.
