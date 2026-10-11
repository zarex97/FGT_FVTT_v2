---
id: 2026-10-10-silence-misses-category-spells
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Silenced, Medea cannot cast any of her seven Spells.
**Actual:** Only Aero greyed, with "Prevented". Argos and Atlas stayed lit, and so did Keraino, Trofa and Dragon Tooth Warriors when off cooldown.
**Cause:** `module/rules/costs.mjs:565 @ 27c8858` — `preventionActionFor` called an ability a Spell only by `isSpell`. Her two Damage Spells carry `isSpell`, and her other five carry only `category: spell`. High-Speed Divine Words finds her Spells by the category, so the two readers disagreed.
**Fix:** `module/rules/costs.mjs:571 @ 40e21e7` — the category counts as a Spell too. `test/unit/medea-193.test.mjs` checks all six against Silence through the real projection.
