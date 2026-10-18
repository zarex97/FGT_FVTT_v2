---
id: 2026-10-18-pc-ended-by-the-first-process
found: test
kind: declaration-or-process
status: fixed
reviewed: false
---
**Expected:** PC.5, *"After performing an Attack while PC is Active, PC is deactivated at the end of the Combat Process"*: a concealed area Attack keeps PC's +100% and its Block/Counter refusal for every defender it caught, and PC ends when the Attack is over.
**Actual:** Danzō's Funshindan caught two Jacks; the first answered and closed while the second had not answered yet, and PC was gone before the second Process reached its damage step (`danzo-249-arena.test.mjs`, "PC still up while the second Process is open: expected false to be true"). Every concealed area Attack in the roster (Jack, Hassan, Serenity) lost PC for whoever answered after the first.
**Cause:** `module/engine/attack.mjs:3160 @ 27c1e9c2` — `endConcealmentAfterAttack` ran from `closeRung` as each Process closed, reading "the Combat Process" as one Process when an area Attack is one declaration and many Processes. Its guard (`state.state !== "done"`) could never fire there.
**Fix:** `module/engine/attack.mjs#endConcealmentAfterAttack @ dfcaa421` — PC ends only when the attacker's last open Process of the declaration's group closes (`siblingStillOpen`).
