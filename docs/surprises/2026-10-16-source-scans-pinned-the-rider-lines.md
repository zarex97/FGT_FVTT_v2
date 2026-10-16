---
id: 2026-10-16-source-scans-pinned-the-rider-lines
found: test
kind: source-scan-pins-text
status: fixed
reviewed: false
---
**Expected:** holding Rho Aias's riders would fail only the tests about Rho Aias.
**Actual:** `jack.test.mjs` "expected -1 to be greater than 0" and `quetzalcoatl.test.mjs` "expected 'async function applyAbilityEffects(st…' to match /\{ when = "afterDamage" \}/".
**Cause:** `test/unit/jack.test.mjs:328 @ cf20cfc` and `test/unit/quetzalcoatl.test.mjs:518 @ cf20cfc` search `attack.mjs` for exact lines of source, so a new option and a third rider call broke them with the behaviour unchanged.
**Fix:** `test/unit/jack.test.mjs:328 @ uncommitted`, `test/unit/quetzalcoatl.test.mjs:518 @ uncommitted` — read the new lines, and the quetzalcoatl scan now expects the third, before-damage call a broken barrier makes.
