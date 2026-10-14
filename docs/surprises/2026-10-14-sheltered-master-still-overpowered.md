---
id: 2026-10-14-sheltered-master-still-overpowered
found: test
kind: generic-path-escapes-special-case
status: fixed
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** A Master its Servant shoved clear of an area Noble Phantasm takes nothing: it is out of the area, and its card shows no damage.
**Actual:** The arena test's shoved Master took 0 damage and was defeated anyway. The write was `system.defeated: true` from `applyDamage`'s `I.defeat(…, "overpowered")`: the Overpower coin still flipped for a Master the Servant had shoved out, and a covered Master too.
**Cause:** `module/engine/attack.mjs:4391 @ 4983091` — the Overpower roll ran for every Servant→Master Process, before and regardless of the group's cover record, which `coverModifiersFor` and `applyAbilityEffects` both read.
**Fix:** `module/engine/attack.mjs:4391 @ cde0483` — a Master the cover record names (shoved or covered) is `sheltered`: no coin, no roll.
