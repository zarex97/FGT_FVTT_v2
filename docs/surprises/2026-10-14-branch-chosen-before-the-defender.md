---
id: 2026-10-14-branch-chosen-before-the-defender
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Brahmastra on Heracles (STR A+, END A, LUC A, each above Karna's) deals 2x plus 100, as the targeting preview showed (270–378).
**Actual:** The card read "Ability multiplier 4× damage, plus 100", 770 landed.
**Cause:** `module/engine/attack.mjs:320 @ 7333e08` — the declaration resolved `damage.branches` once with the caster's own options, no defender in them, and froze that block on every Process as `instanceBlock` (#195's Dohatsu fix); every `not:target:paramVsSelf:*:gt` held. The preview and `describeAttack` resolved it with the defender, so the two readers disagreed.
**Fix:** `module/engine/attack.mjs:320 @ 95b91ea` — the block is resolved per target, with that target in the options; arena tests take 2x on Heracles and 4x on a Master.
