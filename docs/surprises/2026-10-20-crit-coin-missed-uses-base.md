---
id: 2026-10-20-crit-coin-missed-uses-base
found: test
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Crit Up (Viy) reaches *"Attacks which use Base Attack (MAG)"*, and `crit-up-viy.yml`'s own comment said her ranged Normal Attack, BA(STR) plus 10% of BA(MAG), is one of them.
**Actual:** it never was. The rule read `attack:component:mag`, and the band counts as STR. Switching it to `attack:usesBase:mag`, the facet Mad Enhancement's halving reads, still crit nothing: `anastasia-258-rulings.test.mjs` *"crits her ranged shot on a 75"* stayed red.
**Cause:** `module/engine/attack.mjs:5551 @ 50eae993` — the crit coin is flipped against the Attack Description's options before the pipeline runs, and `attack:usesBase:` was derived only inside stage 1 (`rules/damage/pipeline.mjs:395 @ 50eae993`). Two readers of what an attack adds up, one of them blind.
**Fix:** `module/rules/damage/pipeline.mjs#usesBaseOptions @ 0552085c` — one helper; the coin computes the base spec first and adds its options, stage 1 calls the same helper.
