---
id: 2026-10-19-god-hand-failure-unsaid
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** God Hand's last use, tried against Karna's Counter and falling short, says so: the use it burned and the die that failed.
**Actual:** God Hand's `timesUsed` 10 → 11, Heracles defeated, and the only line was *"Berserker is defeated by Lancer."* No card, no log entry, and the 10d20 on no record, so nobody could tell a short roll from a revival that never ran.
**Cause:** `module/engine/scheduler.mjs:1736 @ d64553fc` — `resolveRevival` spends the charges of an attempt that fails ("and so on" is an attempt), and `resolveDefeat` logged a revival only when it worked. No revival card ever carried its dice.
**Fix:** `module/engine/scheduler.mjs:1785 @ ded45740` — a failed attempt logs `reviveFailed` with its dice, the damage left over and the uses left; `engine/revival-report.mjs` posts it (`FGT.Revival.Failed`), and every revival card says what it rolled (`FGT.Revival.Rolled`). `test/unit/heracles.test.mjs`.
