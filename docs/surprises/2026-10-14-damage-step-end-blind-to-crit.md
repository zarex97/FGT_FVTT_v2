---
id: 2026-10-14-damage-step-end-blind-to-crit
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Castor's buff pays on a Normal Attack Crit, and Pollux's only on one that is not.
**Actual:** On a Crit, Pollux's handler fired and Castor's did not.
**Cause:** `module/engine/attack.mjs:5097 @ 1036806` — `fireDamageStepEnd` built its options without `attack:crit`; `fireDamageDealt` beside it passed the crit.
**Fix:** `module/engine/attack.mjs:5101 @ uncommitted` — the Damage Step's result is passed and its crit is an option; `castor-pollux-crit.test.mjs`.
