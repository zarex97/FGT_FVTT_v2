---
id: 2026-10-14-fields-end-a-turn-before-effects
found: test
kind: hidden-timing-rule
status: open
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** a field and an effect stamped with the same expiry end at the same boundary, as effects and terrain do since #161.
**Actual:** a field ends at the start of its expiry Turn and an effect at its end, one Turn apart.
**Cause:** `module/engine/scheduler-hooks.mjs:317 @ 46d0edc` — `expireFields(nextTick)` is handed the incoming Tick, `expireEffects` the one that ended; both ask `expiryReached`.
**Fix:** open. No ruling covers fields; asked as #200 and left unchanged until the rulebook answers.
