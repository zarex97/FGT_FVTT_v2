---
id: 2026-10-17-grand-order-tax-still-charged
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** In a Grand Order war neither the multi-Servant ban nor the tax applies (Ch. 32, CT.go). The spec
called CT.go "Observed (engine)" on `relationships.test.mjs`, which asks `multiServantTax` with `grandOrder: true`.
**Actual:** Player1's Jack attacked as the second Servant of a Master at 25 Health: the ban was lifted. At the
Turn's end: *"Master of Assassin of Faction 1 loses 25 Health (Multi-Servant tax)."* The Master was left at 0.
**Cause:** `module/engine/scheduler-hooks.mjs:142 @ e2b42d22`: the Turn-end context never set `grandOrder`, so
`scheduler.mjs#multiServantIntents` read `undefined`. The Round boundaries carried it; the Turn's did not. The ban
reads the board's `grandOrder`; the tax read the context's. The test asked the rule, never the boundary.
**Fix:** `module/engine/scheduler.mjs:135 @ uncommitted`: the tax reads the board's `grandOrder`, the one the ban
reads. `master-content-241.test.mjs` runs `endTurn` through subjects with the setting on and off. Pressed again:
Jack and Serenity both attacked, Health 200 → 200, no tax line.
