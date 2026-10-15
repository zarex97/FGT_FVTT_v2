---
id: 2026-10-15-np-degen-never-adds-its-turn
found: test
kind: producer-without-consumer
status: open
reviewed: false
---
**Expected:** a shared-clock test for NP Degen on Pollux would see the pair's NP clock grow by 1 Turn per Turn (`np-degen.yml`: *"a negative rate is cooldown ADDED"*).
**Actual:** `advanceCooldowns` emitted nothing for a Noble Phantasm under NP Degen on a single bearer, so the test I drafted (`both(-1)`) had nothing to compare to.
**Cause:** `module/engine/scheduler.mjs:1893 @ 7231295` — `cooldownRate` returns -1 and `if (rate > 0) out.push(…)` discards it; `np-cooldown-regen.test.mjs` pins the rate (-1), never the clock.
**Fix:** open and not part of any ruling in #209: left, listed as §46.4-D5. I dropped the draft test rather than pin the missing behaviour.
