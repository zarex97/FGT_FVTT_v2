---
id: 2026-10-17-seven-identical-half-heals
found: user
kind: role-keyed-on-type
status: fixed
reviewed: true
pattern: role-keyed-on-type
---
**Expected:** each Command Spell button on an attack card says what it does and for whom (#204: *"named
on the button when the Master has several"*).
**Actual:** on Pollux's Noble Phantasm card Player1 saw "Half Heal", "Full Heal" and "Cure Servant" seven
times each, unnamed. The user: *"why are there so many duplicate entries offerings "Half Heal", "Full
Heal" And "Cure servant"?"*
**Cause:** `module/engine/command-spells.mjs#processOffers @ uncommitted` — every live Master on the board
offered its commands on every card, so seven Masters held by one player each offered their Servants'
heals on an attack none of those Servants was in. My first fix named each button by Servant, keyed on
what the PLAYER sees; the user: *"is not by player, is by master servant-relationship"*.
**Fix:** `module/engine/command-spells.mjs#processOffers @ uncommitted` — only a Master in a Contract with
a Unit of the Process (or in it itself) offers anything on its card; naming stays #204's.
