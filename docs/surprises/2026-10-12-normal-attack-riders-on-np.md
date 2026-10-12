---
id: 2026-10-12-normal-attack-riders-on-np
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Zabaniya on Drake inflicts Stage 3 Poison; Projectile's Poison and Deadly Poison and Macabre's extra stage are Normal-Attack riders and stay off a Noble Phantasm.
**Actual:** Drake took Poison at stage 5, and the log read three `damageDealt` handlers: "Projectile (Poisoned Daggers)" twice and "macabre".
**Cause:** `module/engine/scheduler.mjs:380 @ 50a76fe` — `fireEvent` tests a handler's `targetPredicate` against the caller's options plus a bare `rollOptionsFor({attacker: u})`, which emits `attack:kind:normal` for an attack it was not given. #190 fixed the same slip on the roll path (`attack.mjs`), not here.
**Fix:** `module/engine/scheduler.mjs:385 @ 62aa8fc` — the owner's options without any `attack:` option; `test/unit/serenity-199.test.mjs` fires her handlers for an NP crit and a Normal Attack crit.
