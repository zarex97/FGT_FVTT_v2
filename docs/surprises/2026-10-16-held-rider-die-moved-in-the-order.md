---
id: 2026-10-16-held-rider-die-moved-in-the-order
found: test
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** `w.dice.set("d100", 1)` would land Snegleta's Def Dwn (A) both with and without Rho Aias.
**Actual:** without the barrier "rolled 1 vs 55%" applied; behind a broken barrier `defDwnA` came back "resisted".
**Cause:** `test/unit/emiya-208-open.test.mjs:96 @ uncommitted` — a set die is spent by the first d100 rolled. Held, Def Dwn (A) is rolled after the damage, so an earlier d100 took the 1.
**Fix:** `test/unit/emiya-208-open.test.mjs:96 @ uncommitted` — both runs use `w.dice.every(1)`, so the order of the rolls does not matter.
