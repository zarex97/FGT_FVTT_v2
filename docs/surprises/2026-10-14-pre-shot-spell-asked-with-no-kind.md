---
id: 2026-10-14-pre-shot-spell-asked-with-no-kind
found: test
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** when Medea, under Kiritsugu's Decoy, answers Heracles' attack with Return Fire, Kiritsugu's player is asked which Thaumaturgy Spell to cast before the shot, and the one picked is cast.
**Actual:** the arena's first play of it logged `FGT | No renderer for prompt kind "undefined".` No window was shown, `w.asked` was empty, and the spell was never cast.
**Cause:** `module/engine/attack.mjs:2296 @ ebd3f2a` — `offerPreAttackSpell` called `askOwner(owner, {title, options})` with no `kind`, and `apps/prompt.mjs#renderPrompt` answers an unknown kind with `null`. The answer would also have been an array, not the id `useSkill` was given.
**Fix:** `module/engine/attack.mjs:2296 @ a9223aa` — `chooseFor(owner, {title, count: 1, min: 0, options})`, and the first id picked. `test/unit/kiritsugu-pre-shot-spell.test.mjs` fails before it and passes after.
