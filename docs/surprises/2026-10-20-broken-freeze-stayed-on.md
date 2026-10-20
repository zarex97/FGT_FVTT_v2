---
id: 2026-10-20-broken-freeze-stayed-on
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** design R2 (user ruling 2026-09-16): a Unit both Soaked and Frozen, hit by Fire, takes no damage and loses both; Freeze is *"removed with no damage or effects"* (Appendix A).
**Actual:** card LOhRJGdBWh6sn2JV, Nemo's Barrel Bombing on a Soaked, Frozen Asterios: *"negated by Freeze broken by Fire — 0"*, Soaked gone, and Asterios still `freeze`, with the Barrel's `burn` beside it.
**Cause:** `module/rules/damage/pipeline.mjs:264 @ 50eae993` sets `removeFreeze` (and stage 16 for a hit of 150 or more), and no engine file reads it: only a bare damage intent's Fire removed Freeze (`engine/applier.mjs#resolveElements`). The phase riders were refused for a complete negation but not for this one.
**Fix:** `module/engine/attack.mjs#frozenBrokenBy @ uncommitted` — the hit that broke it removes Freeze (Crystalfreeze too at 150 or more); a Fire hit on Freeze lands none of the attack's own effects, while its `damageTaken` still consumes Soaked. `anastasia-258-rulings.test.mjs`, red before.
