---
id: 2026-11-08-aura-sync-raced-platform-teardown
found: live press
kind: check-then-act-race
status: fixed
reviewed: false
---
**Expected:** When GKM leaves, its aura's grant leaves every Unit (`deleteToken` schedules a sync).
**Actual:** *"Golem Keter Malkuth's Light of Wisdom reaches Master of Archer of Faction 1."* appeared after Avicebron fell, and the Master still held `gkmWisdom` with GKM gone. A manual `auraGrantPlan` then planned the removal.
**Cause:** `module/engine/aura-grants.mjs:57 @ dda17e6`: a sync already in flight read the board while GKM still stood. The writes heard during it were dropped: `pending` was cleared and no later pass was owed.
**Fix:** `module/engine/aura-grants.mjs:64 @ uncommitted`: a request heard while a sync runs sets `again`, and one more sync runs after it.
