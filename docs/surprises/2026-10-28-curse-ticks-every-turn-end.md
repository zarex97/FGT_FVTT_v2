---
id: 2026-10-28-curse-ticks-every-turn-end
found: live press
kind: hidden-timing-rule
status: open
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** Curse: "Deals 25 x stage Curse damage at the end of the affected unit's turn" (`effects/curse.yml`).
**Actual:** A staged Curse on Sita (Faction 1) ticked "End of the Turn Archer takes 25 from Curse" at the end of Faction 2's Turn and of the GM's Turn too.
**Cause:** `packs/_source/effects/curse.yml:12 @ a17cfa57` — `periodic: {when: turnEnd}`; which Turns the periodic tick reads as the bearer's is not yet traced.
**Fix:** Open: outside Sita's audit; to be traced against the Curse's own sheets.
