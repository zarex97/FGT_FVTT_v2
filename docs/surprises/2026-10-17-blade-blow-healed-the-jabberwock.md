---
id: 2026-10-17-blade-blow-healed-the-jabberwock
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** Ruled 2026-09-16 (2 R5): *"The Blade's three consequences fire together, once."* One attack: triple damage, the lifesteal gone, the Item destroyed.
**Actual:** Heracles' Blade blow dealt 905 and the same blow healed the Jabberwock by 678: *"Health 95 → 773"*. The lifesteal's `damageTaken` handler ran before the Blade's `damageStepEnd` removal.
**Cause:** `packs/_source/abilities/vorpal-blade.yml @ eebbb988` removes the lifesteal at `damageStepEnd`; `packs/_source/summons/jabberwock.yml @ eebbb988` heals at `damageTaken`, which fires first. Which one the sheet means is not ruled: *"receives 3x damage … and the … effect is permanently removed"*.
**Fix:** Ruled by the user 2026-10-17: it does not. `packs/_source/abilities/vorpal-blade.yml @ 7755ebb4` removes the lifesteal at `damageStepStart` and breaks the Blade at `damageStepEnd`, both on a Normal Attack; `nursery-summons.test.mjs` R5/B7. Re-pressed: *"439"*, 1000 → 561, *"Its lifesteal is removed for good"*.
