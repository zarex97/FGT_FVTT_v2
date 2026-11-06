---
id: 2026-10-14-damage-step-end-blind-to-crit
found: test
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Castor's buff pays on a Normal Attack Crit, and Pollux's only on one that is not.
**Actual:** On a Crit, Pollux's handler fired and Castor's did not.
**Cause:** `module/engine/attack.mjs:5097 @ b959747` — `fireDamageStepEnd` built its options without `attack:crit`; `fireDamageDealt` beside it passed the crit.
**Fix:** `module/engine/attack.mjs:5101 @ cc2a992` — the Damage Step's result is passed and its crit is an option; `castor-pollux-crit.test.mjs`.
