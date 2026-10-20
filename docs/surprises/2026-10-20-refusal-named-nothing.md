---
id: 2026-10-20-refusal-named-nothing
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** With his Spellbook on Cooldown, his bar refuses both Summonings and says what they wait on (HO.book, EH.book, #260).
**Actual:** Player1's bar: "Summoning: Horrors — An ability it depends on is still cooling." The gate knew which ability; the line named none.
**Cause:** `module/rules/items.mjs:702 @ 48916996` — `meetsRequirements` returns only the failed requirement's kind, and `rules/costs.mjs` dropped any detail beside it, so the bar's `abilityState` had nothing to name.
**Fix:** `module/rules/items.mjs:716 @ uncommitted` — an `abilityOffCooldown` refusal carries the cooling abilities' names, `canUseAbility` passes the detail on, and `abilityState` words it `FGT.Ability.CoolingNamed`: "Not while Prelati's Spellbook: … is on Cooldown."
