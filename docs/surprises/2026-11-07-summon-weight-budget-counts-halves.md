---
id: 2026-11-07-summon-weight-budget-counts-halves
found: retraction
kind: claim-without-reading-the-path
status: open
reviewed: false
---
**Expected:** #291 and `docs/model/summon.md` say a summon's weight (Avicebron's Golem 0.2, Babbage's 0.33, Edison's
0.25) is missing only because `unitWeight` is declared on the Servant document alone, so declaring it on a summon
would run it.

**Actual:** the budget counts in halves. A 0.2 Golem would cost `Math.round(0.2 * 2)` = **0**, and 0.33 and 0.25 both
cost a half. Worse, a Unit that acts once per Turn never reaches the pool: the `actsOncePerTurn` branch returns
`pool: null, free: true` first, so a Golem that both acts once and counts would be charged nothing.

**Cause:** `module/rules/budget.mjs:449 @ 97c270b` (`costHalves = Math.round(unitWeight(unit) * 2)`, and again at
`:496`) and `module/rules/budget.mjs:359 @ 97c270b` (`platform || actsOncePerTurn` returns free). The survey read the
field's declaration, not the reader that spends it.

**Fix:** open. Avicebron's audit (2026-11-07) builds it: the budget needs a unit fine enough for fifths and thirds, and
the act-once cap has to sit on top of the pool rather than in place of it. Noted on #291.
