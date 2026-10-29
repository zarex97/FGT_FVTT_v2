---
id: 2026-10-29-outcomes-off-the-card
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** every outcome Tamamo's kit decides is a line on its card.

**Actual:** five were silent: Fox Spouse refusing the Overpower and Underpower coins; a Stun (Balls) held back on a hit
an Invuln took to 0; Yata Strike's grown Crit Chance; Dainisshō's random draw; a staged rider's stage (*"Curse"* for
Stage 2).

**Cause:** `module/engine/attack.mjs:1300 @ 60958e67`: a coin refused printed nothing, only a flipped one did; the
`requiresDamage` gate `continue`d in silence; the pipeline's fixed note, the card context and the landing's summary
had no field for the chance, the die or the stage.

**Fix:** `module/engine/attack.mjs:1300 @ uncommitted` (`refusedCoin`), `:7207` (`FGT.Effect.NeedsDamage`),
`module/rules/damage/pipeline.mjs:370`, `module/apps/chat/cards.mjs:167` (`FGT.Card.Drawn`),
`module/engine/landing.mjs:322` (`stagedName`). Each re-pressed live but the draw, whose re-press waits.
