---
id: 2026-10-11-mode-deactivation-cooldown-unwritten
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Tenmōkaikai's end starts "Cooldown: 7◈+⅓◈ Turns after this NP is deactivated", 22 ticks.
**Actual:** Forced off at tick 16, its cooldown read `remaining: 0`.
**Cause:** `module/engine/cooldown.mjs:61 @ f15a3d1` — the use skips a `countFrom: deactivation` clock, and only a field, a platform and Zero Sail's dimension wrote it at their end. A plain mode had no writer.
**Fix:** `module/engine/scheduler-hooks.mjs:55 @ b9884b9` — `onModeEnded` sets it when any mode with that clock switches off.
