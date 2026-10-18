---
id: 2026-10-17-dead-summon-offered-a-counter
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** A Jabberwock killed by Heracles' Normal Attack is defeated: no Injury Roll, no Counter offered.
**Actual:** Its card read *"341 Injury Roll required"* and the Process stopped at *"Counter-attack? … Waiting for Counter-attack?"*, on a token at Health 0 with the `dead` status.
**Cause:** `module/engine/attack.mjs#counterAvailable @ eebbb988` and the injury rung read `game.actors.get(defenderId)`: for an unlinked summon the world statblock, alive at 1500. 258 such reads across 43 engine files, the same cause as `summon-card-read-the-statblock`.
**Fix:** `module/engine/board.mjs#unitActor @ 7755ebb4` for every engine and `net/operations.mjs` read but the resolver and the statblock's own deletion; `nursery-247-rulings.test.mjs` refuses a new one. The test world still links every token, so no behaviour test can show the difference.
