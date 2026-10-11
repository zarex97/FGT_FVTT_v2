---
id: 2026-10-11-expiring-effect-skips-in-turn-handler
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Crit DmUp (Martial) scales Raikou's crit at tick 4 and spends one of its three uses (R1).
**Actual:** The card read "Attack+ … ×1.30 crit damage", and the effect still held 3 uses.
**Cause:** `module/engine/scheduler.mjs:325 @ f15a3d1` — `fireEvent` skips any handler whose expiry is this tick. That is "an effect does not act on the Turn it ends", a boundary rule. The effect's modifier was still in force at tick 4, while its `damageDealt` handler, the one that spends the use, was skipped. Two readers disagreed about whether the effect is still on.
**Fix:** `module/engine/scheduler.mjs @ b9884b9` applies the skip to boundary events only. `test/unit/raikou-195.test.mjs` covers both sides.
