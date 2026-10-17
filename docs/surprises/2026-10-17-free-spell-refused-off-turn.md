---
id: 2026-10-17-free-spell-refused-off-turn
found: retraction
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Lethal Gunfire Suppression's free Thaumaturgy Spell, offered before the shot on an enemy's Turn, casts.
**Actual:** Read for the grill: the prompt lists all three Spells and the use gate refuses each, Penetration and
Familiars with `notOwnTurn`, Reinforcement with `windowOnly` once reading 1 made it window-only.
**Cause:** `module/engine/attack.mjs#offerPreAttackSpell @ a27e058f` calls `useSkill` with no moment of its own; the
gates of #160 (`notOwnTurn`) and #208 reading 8 (`windowOnly`) were added to `rules/costs.mjs` without sweeping it.
**Fix:** `module/rules/costs.mjs:268 @ uncommitted`, `anyMoment` lifts both for a use granted at another ability's
moment (#243 reading 9); `module/engine/attack.mjs:2689 @ uncommitted` sets it and says a refusal.
