---
id: 2026-10-26-curse-ticks-every-turn-not-holders
found: live press
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** Q13 of Cú Chulainn's grill, ruled as #339 ruling 13: Curse (Bolg) *"deals Curse's 25 at the end of the
holder's Turn"*.
**Actual:** Pressed in War `FwdFxnFteJ3xFCax`: EMIYA (Faction 2) took *"25 from Curse (Bolg)"* at the end of Faction 1's
Turn, the GM's Turn and Faction 2's, three in a row, and was defeated by it.
**Cause:** `module/engine/scheduler.mjs:121 @ cc1d8e41` — `tickPeriodics(units, "turnEnd", ctx)` ticks every Unit at
every Turn's end; only `fireEvent("turnEnd")` is scoped to the active faction. Curse does the same. Q13 was written
from Curse's description, *"at the end of the affected unit's turn"*, not from its reader.
**Fix:** Ruled 2026-10-26 (#339 ruling 35): every Turn's end, as Curse. Ruling 13's words changed; no code changes.
