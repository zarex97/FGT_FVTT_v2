---
id: 2026-10-14-strip-rolled-outside-the-dice
found: test
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Suppression's removal-resistance die is a die the table and the test world can see.
**Actual:** `stripOneBuff` rolled it with `Math.random`: no roll record, and a scripted die could not reach it.
**Cause:** `module/engine/attack.mjs:2284 @ 1036806` — `Math.ceil(Math.random() * 100)` in a runner that re-implemented `fireEvent` for one handler.
**Fix:** `module/engine/attack.mjs:2195 @ uncommitted` — `fireDamageStepStart` rolls with `Roll` and hands the dice to the scheduler's `StripBuff`; `suppression-strip.test.mjs`.
