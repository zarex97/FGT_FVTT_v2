---
id: 2026-10-17-second-jabberwock-card-said-could-not-place
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: false
---
**Expected:** Summoning the Jabberwock a second time places no Blade and says nothing of one: *"When the Jabberwock is summoned for the first time"*.
**Actual:** Player1's card read *"vorpal-blade-cache — couldNotPlace"*: the content id and a raw reason, a failure where the clause had worked.
**Cause:** `module/engine/skill-use.mjs` case `createStructure @ eebbb988` pushed a failed row whenever `createStructure` returned null, and its `once` refusal returns null like a real failure; the row named `phase.structureId`, and the Skill card's template prints `reason` raw.
**Fix:** `module/engine/skill-use.mjs @ 7755ebb4`: a spent `once` phase is skipped with no row; a row names the structure; refused reasons are worded from `FGT.Skill.Reason.*`. `nursery-247-rulings.test.mjs` uses the NP a second time.
