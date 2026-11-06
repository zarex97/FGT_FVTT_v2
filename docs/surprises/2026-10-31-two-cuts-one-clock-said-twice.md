---
id: 2026-10-31-two-cuts-one-clock-said-twice
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Divine Beast's Rage 4: every Skill −1◈, Great Decisive Battle −1◈ more; the card says the change once.
**Actual:** 'Great Decisive Battle at the Southern Sea: Cooldown 12 → 6' printed twice (tick 4).
**Cause:** `module/engine/applier.mjs:488 @ 219a56dc` — one line per cooldown intent, each read before and after the whole batch.
**Fix:** `module/engine/applier.mjs:493 @ 9d2236d7` — one line per clock; unit-tested.
