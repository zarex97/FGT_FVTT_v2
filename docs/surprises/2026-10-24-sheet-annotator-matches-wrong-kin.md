---
id: 2026-10-24-sheet-annotator-matches-wrong-kin
found: tooling
kind: claim-without-reading-the-path
status: open
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** `node tools/capability.mjs --sheet` on the hand-written Arturia (Lancer) Clause list links each
Clause to the key that runs it and a built precedent (deepenings plan Q6/Q13), so a gap it reports can be trusted.
**Actual:** "Used during her Turn" (TL.when, WH.when, BL.when) and "Has the Pierce effect" (RH.pierce) came back
`Ability.classSkill: Riding · classSkill.class-riding-achilles`. RH.area ("Hits a 5x5 area within Range") and
RH.dmg ("None met: 3x damage plus 200") came back `Ability.delivery · gap: none (#281)`, though the Range wall
(#234) and the criteria multiplier (#319) run them. RH.c2 read `Phase.applyEffects: negate an Attack`. 36 of 100
Clauses got no Kin, all six criteria among them, though `field.criteria` runs them.
**Cause:** `tools/lib/capabilities.mjs:584 @ 20ab1afc`: when no sheet Clause sits under the same Ability heading
it scores the short claim against every Clause of the sheet, and a few shared words ("used during … Turn") pick
another Ability's Clause; `:601` then takes the first ledger verdict of that Clause's Kin group, never the key
named by the claim. A short claim has too few word pairs to anchor either step.
**Fix:** Open. The rulings and the Clause list were made by reading the code (`rules/count.mjs`,
`rules/costs.mjs`, the Saber's files), not from the annotation.
