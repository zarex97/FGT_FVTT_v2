---
id: 2026-10-14-every-ability-has-a-ride-block
found: test
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** `if (ability && !ability.system.ridingAttack)` refuses Raikou's Mana Burst on a ride.
**Actual:** the new test still saw the ride go through, unchanged.
**Cause:** `module/data/item/ability.mjs:466 @ 7333e08` — `ridingAttack` is a `SchemaField`, so every ability carries the block; only a number in `distance` makes a ride. The gate keyed on the block's presence without reading one live item.
**Fix:** `module/engine/riding.mjs:68 @ 95b91ea` — asks `classifyAbility(ability).ridesAsAttack`, the reader the sheet already uses.
