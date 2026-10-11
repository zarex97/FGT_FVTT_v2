---
id: 2026-10-11-element-ward-hits-whole-total
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** "All Lightning damage taken is reduced by 50%" takes 25% off a half-Lightning attack.
**Actual:** Sakata's half-Lightning Normal Attack on Raikou read "ward −50" at stage 4, on the whole total.
**Cause:** `packs/_source/abilities/raikou-mana-burst-lightning.yml:113 @ f15a3d1` — authored as a `Ward` on `attack:element:lightning`, a stage-4 reduction of everything. Stage 4b, which scales by the element's share, reads `elementDefUp`, and `DamageModifier` dropped `element`.
**Fix:** `module/rules/elements.mjs @ b9884b9` — `DamageModifier` carries `element`. The passive is `elementDefUp` scoped to Lightning. A test pins 200 → 150.
