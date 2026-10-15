---
id: 2026-10-14-riding-passives-ungated
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** Karna's Riding: *"Additionally, 'Double Move', 'Riding Attack', and 'Passenger Seat' can be used on this Turn"*, so with the Active not used this Turn his bar offers no ride (as Drake's, R2 on #187).
**Actual:** Round 3, Riding switched off and MOV 7: the bar's Riding Attack opened its destination picker with the column offered.
**Cause:** `packs/_source/servants/karna.yml:46 @ 7333e08` — he took the shared `class-riding`, which grants the three passives unconditionally; Raikou's identical sentence took it too, and her audit (#195) pressed Double Move with Riding off.
**Fix:** `packs/_source/class-skills/riding-unlocks.yml @ 95b91ea` — a variant gating all three on `ridingActive`, MOV a parameter; Karna (5) and Raikou (5) take it, and her copies exclude it.
