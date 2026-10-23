---
id: 2026-10-22-range-grew-on-last-moment
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** *"If there are no Units within its Range for 1 full Round, its Range will increase by 1 at the start
of the next Round"*: a Round with Nemo beside it at every Turn's end holds the growth back.
**Actual:** Nemo stood next to the Gigantic Horror through Round 25; it was moved off in the GM's slot, the Round's
last Turn, and "No Unit came within reach of Caster this Round: its Range grows to 4." followed.
**Cause:** `module/engine/form-range.mjs:24 @ d97795b9` — `growFormRanges` read the board once, as the Round ended:
the last moment stood in for the whole Round, and the unit test called it with nothing in between.
**Fix:** `module/engine/form-range.mjs @ 965a7cc5` — `noteFormReach` marks the Round (`formRangeSeen`) at every
Turn's end with a Unit in reach, and the Round's end grows only an unmarked Round; test "a Unit in reach at any
Turn's end holds that Round's growth, though it left before the Round ended".
