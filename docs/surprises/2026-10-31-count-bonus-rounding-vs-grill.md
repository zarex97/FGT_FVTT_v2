---
id: 2026-10-31-count-bonus-rounding-vs-grill
found: live press
kind: claim-without-reading-the-path
status: open
reviewed: false
---
**Expected:** My grill pick for #362 reading 18 said Rhongomyniad's *"increases by ½◈ for every criteria"* adds 2 Turns per criterion at 3 Turns a Round.
**Actual:** Five criteria set the clock to 23 (15 + 8), not 25: "Cooldown 23 → 18".
**Cause:** `module/engine/cooldown.mjs:271 @ fe7e8891` sums the fractions and rounds once over the whole (#283, Excalibur Proto: "four ½◈ are 2◈"). I wrote the figure without reading `countBonusTicks`.
**Fix:** Open: put to the user, #283's one rounding or ½◈ per criterion.
