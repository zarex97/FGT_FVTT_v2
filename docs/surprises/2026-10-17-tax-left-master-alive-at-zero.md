---
id: 2026-10-17-tax-left-master-alive-at-zero
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** A Master the multi-Servant tax empties is defeated, as anything emptied of Health is.
**Actual:** Live, a Master at 25 paid 25 and stood at 0 Health, `defeated: false`; it died only at the Round's end,
to a Poison tick. Once the tax did defeat, the Turn-end card still read only *"loses 25 Health (Multi-Servant tax)."*
**Cause:** `module/engine/scheduler.mjs:2546 @ 7d305217`: the tax's `statDelta` carried no `defeatsAtZero`, which
is the one flag `applier.mjs#statDelta` asks before running the defeat chain; only a field's toll set it. And
`turn-report.mjs#turnEndCard` read Health deltas, never who they killed.
**Fix:** `module/engine/scheduler.mjs:2550 @ 3a0cd48d` sets `defeatsAtZero` (ruled 2026-10-17). `module/engine/turn-report.mjs#postTurnEndReport @ 3a0cd48d`
names the Units its losses defeated. Live: *"Caster loses 25 Health (Multi-Servant tax). Caster is defeated."*,
both Scáthachs Free.
