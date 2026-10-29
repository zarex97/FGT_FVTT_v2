---
id: 2026-10-29-random-draw-made-at-declaration
found: live press
kind: hidden-timing-rule
status: fixed
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
**Fix:** `module/engine/attack.mjs:8478 @ uncommitted` — the user ruled a strict sequence: a declaration with drawn hits
strikes one at a time, each declared when every Process before it is done (`advanceDrawnHits`, `attack.mjs:1938`), its
die rolled then over the defenders still standing (`drawHit`); nobody left, the hit says so and strikes nothing; the
Phase ends after the last strike. `docs/21-combat-process.md` had recorded the old reading ("as it strikes" read at the
declaration) as a choice; it now says the ruling.
