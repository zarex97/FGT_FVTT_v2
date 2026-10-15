---
id: 2026-10-15-joint-np-range-and-crit-read-the-declarer
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** the ticket: for the joint NP "an effect held by both twins counts twice", "either twin within 2 of the target is enough" and "Crit from both twins combines". Each reads as one change to the NP's combination.
**Actual:** three different readers, one of them already right. The damage bag already concatenated the partner's (two Divine Cores are +160: a predicted-green pin that came up green). Range was measured from the declarer alone (`expected [ 'Heracles is out of Range (2).' ] to deeply equal []` for a foe only Castor reaches), and the Crit Chance rolled read the declarer's `checkModifiers` alone (`expected 70 to be 90`).
**Cause:** `module/rules/targeting/resolve.mjs:795 @ 7231295` (`resolveAnchor`, `targetUnit` measures from `casterPanels`) and `module/rules/checks.mjs:402 @ 7231295` (`critChance` sums `attacker.checkModifiers`). `damage.modifierSources` joined the bags in the pipeline (`activeMods`) and nowhere else; the chance is rolled BEFORE the pipeline runs, and the Range is checked before either.
**Fix:** `module/rules/targeting/resolve.mjs:799 @ 1de1f43` (`alsoFrom: partner` on the anchor, `partnerPanelsOf`), `module/rules/checks.mjs:408 @ 1de1f43` (`alsoFrom` Units), `module/rules/damage/pipeline.mjs @ 1de1f43` (`modifierSourceUnits`, the one reader of which Units join, used by the union and the chance). `dioscuri-209-rulings` and `dioscuri-209-arena` fail with either call site put back.
