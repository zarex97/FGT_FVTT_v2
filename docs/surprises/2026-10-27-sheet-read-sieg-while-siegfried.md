---
id: 2026-10-27-sheet-read-sieg-while-siegfried
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Transformed, his sheet is Siegfried's: Saber, Chaotic Good, Germany (ruling 1).
**Actual:** Player1's sheet header read *"Caster · Neutral Good · Europe"*, the Details tab listed *"caster"*, and the contract button stayed, while the board read Saber.
**Cause:** `module/apps/actor-sheet/context.mjs:327 @ 56dd6f15` — the header, the Details tab and `canContract` read `actor.system`, not `rules/form.mjs#formSheet`, the reader the board uses.
**Fix:** `module/apps/actor-sheet/context.mjs:241 @ a6b12a1b` — all three read `formSheet`; the seat stays Caster. Re-pressed: *"Caster · Chaotic Good · Germany"*, Details *"saber"*.
