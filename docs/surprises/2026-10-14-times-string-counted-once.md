---
id: 2026-10-14-times-string-counted-once
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Gogh's `times: "@stageDelta"` grants one Atk Up per Curse stage a Crit removes: two.
**Actual:** One Atk Up. `stackTimes` returned 1 for any string.
**Cause:** `module/engine/scheduler.mjs:1406 @ a436802` — `stackTimes` knew numbers and `perStack`, not an event field.
**Fix:** `module/rules/effect-flow.mjs:494 @ uncommitted` — `timesOf` reads the event field, taken whole; on a non-counted effect Landing makes it applications.
