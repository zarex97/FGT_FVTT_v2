---
id: 2026-10-18-pc-numbers-read-three-ways
found: test
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** A Unit granted Presence Concealment C+ by Dongyū Method 1 is discovered 35% of the time and gives its DU's Evade +2, as her sheet prints (#249 readings 2, 4).
**Actual:** Three readers each found the PC Skill by slug: the Evade bonus fell back to a literal 4 without one, `discoverChance` kept its own copy of the table and answered 100% without one, and the cooldown read the table a third time. A Unit with the effect and no Skill would have been found on every Discover roll.
**Cause:** `module/rules/identity.mjs:280 @ 27c1e9c2`, `module/engine/attack.mjs:4108 @ 27c1e9c2` — the numbers were read off the Skill item, never off the effect instance that *is* the state, and the instance had no field to carry a Rank.
**Fix:** `module/rules/concealment.mjs#concealmentProfile @ dfcaa421` — one reader, from the instance's new `params` (`EffectData.params`) first and the Skill second; `discoverChance` and the Evade bonus ask it, and a granted instance's end starts no clock (`engine/concealment.mjs#onConcealmentRemoved`).
