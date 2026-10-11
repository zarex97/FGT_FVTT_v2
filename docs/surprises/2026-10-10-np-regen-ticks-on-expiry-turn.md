---
id: 2026-10-10-np-regen-ticks-on-expiry-turn
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Teachings of Circe's NP Regen for 1◈ takes ⅓◈ off at three Turn Ends, 1◈ in total (reading 7).
**Actual:** EMIYA's Unlimited Blade Works went 12 → 10 → 8 → 6 → 4 over Turn Ends 2–5, then 1 a Turn. Four regen ticks, 1⅓◈.
**Cause:** `module/engine/scheduler.mjs:1852 @ 27c8858` — `npRegenOf` asked only whether the effect was held. `tickPeriodics` skips an instance on the Turn it expires, and this second reader of "a per-Turn effect ticks" did not.
**Fix:** `module/engine/scheduler.mjs:1860 @ 40e21e7` — it skips an instance whose expiry is this tick. `test/unit/medea-193.test.mjs` checks ticks 2, 3, 4 and not 5.
