---
id: 2026-10-16-strike-moved-without-a-line
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Golden Rule's Crit with no NP on Cooldown brings Enki a Turn closer, and the table sees it happen
(#232 reading 14).
**Actual:** the fire tick moved 37 -> 36 and no card, line or sheet said so: the count is on no document a player
can open.
**Cause:** `module/engine/schedule.mjs:126 @ 2e097ec` — `shiftStrikes` wrote the Combat flag and nothing else.
**Fix:** `module/engine/schedule.mjs:126 @ 2e097ec` — it posts *"Enki: Sword of the End comes a Turn closer
(Golden Rule): Archer's strike lands in N Turn(s)."*, naming the source the intent carries.
