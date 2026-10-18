---
id: 2026-10-18-accept-the-hit-never-reached-gm
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** a defender's answer ("Block", "Accept") moves the card on at once; a rung the GM holds open for a Command Spell shows that offer while it waits.
**Actual:** Player2 pressed Block and the card still read "Choose a reaction … Waiting for Choose a reaction (0:59)" for about 90 seconds, then jumped to the result. Player1's "Accept" did the same and the console said "No reply from the Gamemaster for "advanceProcess" within 60s." The GM's flag sat at the answered rung throughout; nothing was waiting on a question (`FGTSocket.ask` was never called). Tutorial Demo war, Round 2, Normal Attacks between the Lancers and the Archer.
**Cause:** `module/engine/attack.mjs:4619 @ b7005fed` — `closeRung` holds each interruptible rung up to `commandSpellTimeout` (45s) in `awaitInterrupt`, but wrote the flag and the card only when the whole run ended. For each held rung the card showed the question already answered, and the Command Spells the hold was for (Damage Block, Half Heal) never reached the screen. With two held rungs a run outlasted the 60s socket wait, so the player's request also reported a failure.
**Fix:** `module/engine/attack.mjs:4631 @ 12f979b2` — `awaitInterrupt` writes the flag and re-renders the card before it starts holding. `test/unit/held-rung-shown.test.mjs` fails without it ("the card still showed the rung that was answered: expected 'react' not to be 'react'").
