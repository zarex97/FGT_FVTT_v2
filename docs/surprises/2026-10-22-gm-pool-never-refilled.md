---
id: 2026-10-22-gm-pool-never-refilled
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** in each GM's slot the Gigantic Horror may Attack again, its side's pool full.
**Actual:** Round 28's GM slot refused its Attack: "Cannot attack: Servant attacks exhausted (2/2)", the two
spent in Round 25's slot.
**Cause:** `module/engine/scheduler-hooks.mjs:365 @ d97795b9` — a GM-driven form spends from the `gm` side's pool
(`control.mjs#GM_SIDE`), and the Turn start resets the incoming faction's, which the GM's slot has none of:
`budget.reset(combat, null)` returns at once. The pool had a spender and no refill.
**Fix:** `module/engine/scheduler-hooks.mjs:369 @ 965a7cc5` — the GM's slot resets the `gm` side's pool; test
`round-boundary.test.mjs` "begins with the GM side's pool full".
