---
id: 2026-10-16-legion-offer-walked-every-actor
found: live press
kind: role-keyed-on-type
status: fixed
reviewed: false
---
**Expected:** a war with no Hassan in it never mentions Hassans.
**Actual:** in Arturia's war, at the start of Rounds 2 and 3, Player1 was shown "Hassan 12 — Deploy up to 10 Hassans (34/100 remain). Pick a panel for each, or close to stop." on Arturia's board, again on every page load.
**Cause:** `module/engine/legion.mjs:239 @ b4464ed` — `offerLegionDeploys` asked every actor in the world that holds a legion pool, not the ones in this war; the Hassan audit's Master still held his, and war faction ids repeat, so his "faction-2" found this war's base. Asked by what the actor carries, never by whether it is in the match.
**Fix:** `module/engine/legion.mjs:244 @ 9d0ab57` — only a holder on this board, or a legion with a living body on it, is offered. Arena test in `hassan-226-arena.test.mjs`, which first passed for the wrong reason (no base for his faction) and now proves the panels exist.
