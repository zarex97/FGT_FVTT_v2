---
id: 2026-10-10-fixedvalue-stood-in-for-base-attack
found: test
kind: fixture-stands-in-for-the-real-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** Skipping stage 2 for a `fixedValue` base touches only Nemo's two Skills, since every other
authored flat base is `fixed: true`.
**Actual:** Six crit tests failed: `expected [ 'no Base Attack: no Attack± roll' ] to deeply equal [ '5d10 = 30, ×1.50 crit damage' ]`.
**Cause:** `test/unit/crit-vs-np.test.mjs:39 @ d162f50` and `test/unit/effect-catalogue-unreached-readers.test.mjs:32 @ d162f50` used `base: { fixedValue: 200 }` as a short way to say "Base Attack 200", a shape no authored Normal Attack has.
**Fix:** `module/rules/damage/pipeline.mjs:379 @ df93ff7` skips the roll for a figure; both fixtures now name `sources: [{ unit: "self", component: "str", factor: 1 }]`.
