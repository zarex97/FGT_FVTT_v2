---
id: 2026-10-14-teleport-commands-moved-nobody
found: test
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Ruling Q6 needed only to keep Gate of Skye from closing the Command Spell escape: Escape bought on an attack card would carry the defender out.
**Actual:** Escape and Teleport Servant never moved anyone anywhere. Both author `teleport`, which needs `ctx.destination`, and neither caller (the card, the Master's bar) ever sent one: the spend paid, logged `commandNeedsDestination`, and the Process recorded the teleport `applied: false`.
**Cause:** `module/engine/command-spells.mjs:279 @ 4983091` — the destination had no producer, and `combat-process.mjs`'s `escape` interrupt had no producer either: no command authors it.
**Fix:** `module/engine/command-spells.mjs#interruptsOf @ cde0483` — the player picks a landing first (`teleportPanels`), an unlandable spend is refused before it is paid, and a teleport that moves a Process's defender is the `escape` interrupt.
