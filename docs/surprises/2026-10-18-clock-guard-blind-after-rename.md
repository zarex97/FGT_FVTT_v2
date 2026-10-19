---
id: 2026-10-18-clock-guard-blind-after-rename
found: test
kind: passes-for-the-wrong-reason
status: fixed
reviewed: true
pattern: passes-for-the-wrong-reason
---
**Expected:** replacing `game.combats.active` with `currentWar()` leaves `test/unit/clock-reads.test.mjs`'s count of direct clock reads at 101: the reads are the same reads.
**Actual:** "Direct clock reads fell to 95: lower DIRECT_CLOCK_READS to it." Lowering it as the message says would have hidden six live clock reads from the guard for good.
**Cause:** `test/unit/clock-reads.test.mjs:37 @ b6239686` — `CLOCK_READ` named the reader by its spelling (`combats?.active?.round`), so a rename looked like a removal.
**Fix:** `test/unit/clock-reads.test.mjs:40 @ ddf335e4` — the pattern also matches `currentWar()?.round`, and the count stays 101.
