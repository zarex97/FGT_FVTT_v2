---
id: 2026-10-15-second-copy-of-np-category
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** stamping `categorizedAsNP` on the declared attack spec, beside `asNormalAttack`, was a one-line
addition: `attack:isNP` needs the flag on the declaration, and `buildAttackSpec` already reads the ability.

**Actual:** the full suite failed one guard I had not thought of:
`preview-matches-resolution.test.mjs > one builder of an ability's identity > reads the ability's Rank and NP
category in exactly one place` — `expected [ 'categorizedAsNP: Boolean(', …(1) ] to have a length of 1 but got 2`.
`attackIdentityOf` is the one place an ability's NP category is read, and the declaration had grown a second.

**Cause:** `module/engine/attack.mjs:771 @ 7231295` — the stamp I wrote read `ability.system.categorizedAsNP`
itself. The identity builder carried the flag for the pipeline only; the option set is built from the
declaration, which is why it was missing there, and the quick fix was a second reader of the same rule.

**Fix:** `module/engine/attack.mjs:771 @ 3cc6a34` — `categorizedAsNP: attackIdentityOf(ability, options).categorizedAsNP`,
so the declaration, the pipeline and `isNPAttack` read one definition.
