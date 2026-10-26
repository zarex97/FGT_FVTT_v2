---
id: 2026-10-25-interrupt-window-had-no-pass
found: user
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Once both players have walked an attack's ladder to its end, the hit lands.
**Actual:** The card sat on "Interrupt with a Command Spell?" for the whole window. The user: *"There should no need
of waiting for a GM… the final result was the the DU was hit, what is the need of waiting for the GM? It should be
immediate."*
**Cause:** `module/engine/attack.mjs:5016 @ cc1d8e41` — `awaitInterrupt` holds every rung with an offer until a
Master spends or `commandSpellTimeout` runs out, and the card offered only commands to spend: no way to say "none".
At 15 s it was a pause; at the 180 s this War was set to, three minutes a rung, read as waiting on the GM.
**Fix:** `module/engine/attack.mjs:5024 @ d3452f94` — a "No Command Spell" button on the card's window
(`templates/chat/attack.hbs`, `module/apps/chat/cards.mjs#passFor`), written by the GM through
`OPERATIONS.passCommandSpells` and keyed to the rung (`combat-process.mjs#rungKey`); the hold ends once every
offered Master has passed. Not yet pressed live.
