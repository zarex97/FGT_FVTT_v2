---
id: 2026-10-14-soaked-ice-gate-dropped
found: test
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Soaked raises Freeze's chance by 25 only when the Unit receives Ice damage, as its `predicate: ["attack:element:ice"]` says.
**Actual:** Under a Fire attack and under no attack, a 50% Freeze read "rolled 99 vs 80%": the +25 applied every time.
**Cause:** `module/rules/elements.mjs:1975 @ 5ab593e` — collection deferred the `attack:` predicate and handed it to the executor as `deferred`; `ApplicationChance` read only `attackPredicate` and dropped it.
**Fix:** `module/rules/elements.mjs:1978 @ b30e86e` — the contribution carries `attackPredicate ?? deferred`; `test/unit/soaked-freeze.test.mjs` fails with it reverted.
