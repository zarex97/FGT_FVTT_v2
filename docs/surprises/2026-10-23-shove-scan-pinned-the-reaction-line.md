---
id: 2026-10-23-shove-scan-pinned-the-reaction-line
found: test
kind: source-scan-pins-text
status: fixed
reviewed: true
pattern: source-scan-pins-text
---
**Expected:** the full suite green after the "cannot React" fix (#328): Akhilleus Kosmos's shove still offers no
reaction ability, so nothing that guards it should move.
**Actual:** `achilles.test.mjs` "which spends nothing and leaves nothing to react with" failed on
`expect(attack).toMatch(/\[defenderId\]: declared\.plainDamage\s*\? \[\]/)`. The shove's behaviour was unchanged.
**Cause:** `test/unit/achilles.test.mjs:851 @ d24c003e`: the test reads `engine/attack.mjs` as text and pins the exact
ternary; `module/engine/attack.mjs:1135 @ 7f02a2c2` added `|| (declared.forbidReactions ?? []).includes("abilities")`
to it.
**Fix:** `test/unit/achilles.test.mjs:852 @ 7f02a2c2`: the pattern accepts the added clause, with a comment naming
#328. The shove stays guarded by the same scan.
