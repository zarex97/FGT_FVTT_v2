---
id: 2026-10-19-delay-moved-nobody
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** #82 said a Delay compounds within its Round and that a carried Delay misses the next Round's opening order; building the ruling, a Delay declared on the HUD moves its faction somewhere.
**Actual:** it moved nobody, ever. The HUD's *Declare* is offered to the faction whose Turn it is; `delayFaction` stored it and recomputed `system.turnOrder`, which `_onUpdate` never applies mid-Round; `markTurnTaken` then marked that faction as having acted, so the carried Delay reached `rollTurnOrder`, which computed the opening order with `{}` and stored the Delay again. Every Round it was carried and never read.
**Cause:** `module/documents/combat.mjs:165 @ 856a58ff` — `computeTurnOrder(order, {}, [], gm)` in `rollTurnOrder`; `:243` stored a pending faction's Delay instead of applying it.
**Fix:** `module/documents/combat.mjs#rollTurnOrder @ a87324ca` applies the carried Delays to the opening order and clears them; `#delayFaction` moves a faction still to come at once through `turn-order.mjs#applyDelay` and stores nothing; `markTurnTaken` no longer recomputes. Pressed live 2026-10-19 twice, each side: Red, then Blue, declared Delay+1 on its own Turn, rolled first next Round, and opened second; `system.delays` read `{}` after.
