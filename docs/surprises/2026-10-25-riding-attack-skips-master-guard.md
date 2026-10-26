---
id: 2026-10-25-riding-attack-skips-master-guard
found: user
kind: generic-path-escapes-special-case
status: wontfix
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** The user: *"a master can't be attacked if his servant is in a 2 cells area, but I think is counting
it as 1"*. Arturia (Lancer) hit Heracles's Master in Round 9 with Heracles beside him.
**Actual:** No guard line. The guard rules measure 2 panels as written (`rules/master-guard.mjs#GUARD_RADIUS`).
That Attack was a Riding Attack, and it never asks them.
**Cause:** `module/engine/riding.mjs:188 @ cc1d8e41` — a ride places `pathTargets`, with no `unitId`, so
`resolveAttack`'s guard step (`aimedAt === targetIds[0]`) and targeting step 8 (`isChosen`) both pass it by.
**Fix:** None, ruled 2026-10-25: a Riding Attack is an area, so the three guard cases do not apply to it. The ride
was right; the rulebook's optional Cover for a non-NP AoE, still unbuilt, is what would apply.
