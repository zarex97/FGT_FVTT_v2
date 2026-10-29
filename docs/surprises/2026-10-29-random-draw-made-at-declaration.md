---
id: 2026-10-29-random-draw-made-at-declaration
found: live press
kind: hidden-timing-rule
status: open
reviewed: false
---
**Expected:** reading 31 (`docs/superpowers/specs/2026-10-29-tamamo-clauses.md`): each of Dainisshō's hits 1 to 8
"picks an enemy at random among those in the area as it strikes … with none left a hit does nothing". DN.random was
ticked on a board where no enemy fell mid-Attack.
**Actual:** War B in Japan, Player1's Dainisshō on Asterios, his Master (max Health 102) and Arjuna: the log says
"defeat: Master of Berserker of Faction 2" after the fourth hit, and two later hits were still drawn for him ("Drawn at
random: d3 = 1"), each dealt "50", and hit 9 struck him again. The card said "Master of Berserker of Faction 2 is defeated
by Caster." twice.
**Cause:** `module/engine/attack.mjs:8323 @ 03883e1` — `processRows` rolls all eight draws when the Attack is declared,
over the defenders the area caught then, and `declareProcesses` fixes each Process's defender before any hit lands.
**Fix:** open — the draw has to move to the hit; how, with Processes that overlap while a reaction is awaited, is put to
the user.
