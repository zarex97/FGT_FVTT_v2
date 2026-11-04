---
id: 2026-11-04-way-out-refused-after-the-release
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** Enuma Elish from inside Bug Space is offered when it can be used, and my marker on the prompt said *"the use is asked its gate when it declares"*.
**Actual:** With the Master below the price, Player1 was offered it. The press wrote *"Archer is forced out of AlterEgo's Bug Space"*, then the GM console: `Uncaught (in promise) Error: FGT | Cannot use this ability: its Master needs MORE than 75 Health to pay for it.` No Attack, no seal, no line for the player.
**Cause:** `module/engine/bug-space.mjs:279 @ ff814c4b` — `forceOut` ran before `resolveAttack`, whose gate was the only one, and the offer filtered on the Cooldown alone.
**Fix:** `module/engine/bug-space.mjs @ 96edc10a` — `pressGate` before the offer and again before anyone comes out, and a refused press says why.
