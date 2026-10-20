---
id: 2026-10-19-god-hand-card-hid-its-uses
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** a God Hand cascade that spends two of his eleven uses says so on the card a player reads.
**Actual:** Arturia's Mana Burst into Heracles at 1 Health: God Hand's `timesUsed` 0 → 2, and the only line was *"Berserker is defeated and revived by God Hand: Twelve Labors, with 47 Health."*
**Cause:** `module/engine/revival-report.mjs:23 @ d64553fc` — the `revive` log entry carried `charges` since the ledger fix, and the card read only `amount`; nothing carried what a counted source had left.
**Fix:** `module/engine/scheduler.mjs:1768 @ ded45740` — the entry carries `left` for a counted source, and the card adds *"Uses spent: N; M left."* (`FGT.Revival.Charges`). `test/unit/heracles.test.mjs`.
