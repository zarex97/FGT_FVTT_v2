---
id: 2026-10-17-escape-resistance-skipped-a-status
found: test
kind: generic-path-escapes-special-case
status: fixed
reviewed: false
---
**Expected:** A Unit whose escapes put its Nameless Forest Resistance at 100 is never caught again (Part 3 R7: 10% per escape, from 100%).
**Actual:** The marker landed on it anyway. The resistance was collected (`applicationChances` held `effectId: namelessForest, value: 100`) and never subtracted.
**Cause:** `module/engine/effect-applier.mjs#chanceContribution @ eebbb988`: `def.polarity !== (c.polarity ?? "debuff")` skipped every contribution about a non-debuff, and the forest's marker is a status. The generic "debuffs only" filter swallowed a resistance that names its own effect.
**Fix:** `module/engine/effect-applier.mjs#chanceContribution @ uncommitted`: a contribution that names its effect skips the polarity filter; `nursery-247-rulings.test.mjs` lands none of the forest on a Unit at 100.
