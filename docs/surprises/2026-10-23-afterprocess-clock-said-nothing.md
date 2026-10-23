---
id: 2026-10-23-afterprocess-clock-said-nothing
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** the #322 regression press L2-11: Nemo's Quickfire, not Countered, refunds 1◈ of its own
Cooldown, and the card reads "Quickfire: Cooldown … −1◈".
**Actual:** pressed live as Player1 on 2026-10-23. The clock fell 6 → 3, and the Quickfire card had no
cooldown line at all. The refund was written, and nobody was told.
**Cause:** `module/engine/attack.mjs:2505 @ b6c19978`. `runAfterProcessPhases` wrote its batch with
`applyBatch` and dropped the lines `applyIntents` returns. Every other clock an Attack turns, the settle
included, goes through `applyWithLines` onto the card. This dates from 2026-09-11, not from #322.
**Fix:** `module/engine/attack.mjs#runAfterProcessPhases @ 74abd056`. It takes the Process's card,
applies through `applyWithLines`, and adds the rows to the card. `cooldown-settle.test.mjs`, "Quickfire
not Countered", was red first. Pressed again live: "Quickfire: Cooldown 6 → 3" on Player1's card.
