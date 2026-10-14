---
id: 2026-10-14-one-rung-pressed-twice-runs-twice
found: live press
kind: check-then-act-race
status: fixed
reviewed: true
pattern: check-then-act-race
---
**Expected:** a reaction rung answered twice (the GM's card and the defender's player both pressing) runs once; the second press finds the Process past that rung.
**Actual:** pressed live from two clients during Wave A's check (one press from the GM's page, one from Player1's through `advanceProcess`): Kiritsugu's Return Fire was declared twice — two "Lethal Gunfire Suppression: Return Fire" cards, and the pre-shot question opened twice on Player1's page. A reaction timer later threw `Uncaught (in promise)` from `combat-process.mjs:286` via `await-timeout.mjs#applyExpiry` on a Process already past its rung.
**Cause:** `module/engine/attack.mjs:1259 @ 26d95f4` — `advanceAttack` reads the state from the message flag, then awaits (the pre-shot question) before writing the next state, so a second press reads the same `react` state. Unverified beyond this press; the second press here came from a test script, though a GM and a player can both press a card's button.
**Fix:** `module/engine/attack.mjs @ f789a77` — `advanceAttack` claims the rung it answers (`messageId`, history length, state) in memory before anything awaits; a second press of it waits for the first and runs nothing. `test/unit/rung-pressed-twice.test.mjs` played the doubled press in the arena first: Medea ended at 25 Health instead of 372.
