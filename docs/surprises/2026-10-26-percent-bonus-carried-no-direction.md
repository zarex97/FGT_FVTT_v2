---
id: 2026-10-26-percent-bonus-carried-no-direction
found: retraction
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** `attack:vsAttribute:<attribute>` names an attack that deals extra damage to an Attribute, read off the
attacker's damage-dealt modifiers (Kagome Spirits, #260). I took it as the Anti-Dragon reader for Armor of Fafnir.
**Actual:** it read only modifiers with `direction: "dealt"`, and `DamageModifier` pushed none, so a percent bonus
against an Attribute (Dmg Up (Gods), Dragon Slayer's Passive, Dmg Up (Dragon)) never counted. Only `FlatDamage` said
`dealt`, added for Excalibur's +50 against Dark.
**Cause:** `module/rules/elements.mjs:1103 @ d3452f94` — the `DamageModifier` push carried `key` and `value` and no
`direction`, which `module/rules/options.mjs` filtered on.
**Fix:** `module/rules/elements.mjs:1110 @ dc6ed266` — `DamageModifier` states `direction`; `rules/options.mjs#antiAttributesOf`
is the one reader, and an attack's own stage-3 row counts too (#341 ruling 5).
