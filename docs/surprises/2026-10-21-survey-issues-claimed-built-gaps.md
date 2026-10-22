---
id: 2026-10-21-survey-issues-claimed-built-gaps
found: retraction
kind: claim-without-reading-the-path
status: open
reviewed: false
---
**Expected:** each Character model issue, #281 to #311, names a gap the engine cannot run today. Its "today"
line says what the code does.

**Actual:** three issues say the engine lacks what it already runs:
- #284 says *"`RankShift` shifts an Ability's Rank"* only. Its Parameter branch exists and is authored
  (Kiritsugu's Affection of the Holy Grail, `parameter: luc`).
- #287 says *"no War Rule turns it off"*. A War's `phase` takes `none`, and the snapshot turns the cycle off
  for it.
- #290 says *"Nothing replaces a defeated summon today."* `splitSummon` and the `Split` handler run Gilles's
  Horrors, built in #260 reading 12.

**Cause:** `module/rules/elements.mjs:1531 @ d1f69b6f`, `module/data/misc.mjs:174 @ d1f69b6f`,
`module/rules/snapshot.mjs:1325 @ d1f69b6f`, `module/engine/summoning.mjs:607 @ d1f69b6f`,
`module/engine/scheduler.mjs:1468 @ d1f69b6f`. The survey's step 3 asks "Does the engine run it today?" and
the answer came from the model's own files and a grep for one word, not from the authoring vocabulary.
Nothing maps a model Shape to the authored keys that run it.

**Fix:** open. Narrow the three issues to their real gaps: a Parameter shift per token or during Combat
(#284), an ability's no-cycle alternative and a `phase:none` option (#287). #290 is built whole, the
Light-damage exemption included (`unlessAttack`): Prelati's coin is content only. The architecture review of 2026-10-21 proposes a capability lookup the survey asks first.
