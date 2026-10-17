---
id: 2026-10-17-free-spell-spent-the-cap
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** On Faction 2's Turn Player1 took Return Fire with Penetration as the free Spell, then Reinforcement at
the shot's Combat Phase: the free Spell *"does not count towards the one Thaumaturgy Spell usage per Turn"*.
**Actual:** GM console *"Thaumaturgy: Reinforcement cannot be used: categoryUseLimit."*; no N.Atk Up on the shot.
**Cause:** `module/engine/skill-use.mjs:228 @ a27e058f` recorded the free use like any other, and
`module/rules/costs.mjs#categoryLimitFor @ a27e058f` counted every recorded use: the exemption covered the free use's
own gate and not the count the next use reads.
**Fix:** `module/engine/io.mjs#recordUse @ 5101f86f` keeps `turnState.categoryExempt`, declared on the DataModel and
`TURN_RECORD`; `module/rules/costs.mjs#categoryLimitFor @ 5101f86f` reads it off.
