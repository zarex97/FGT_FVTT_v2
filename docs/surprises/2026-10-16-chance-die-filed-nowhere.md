---
id: 2026-10-16-chance-die-filed-nowhere
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Arturia's Counter, Invisible Air off, wins Excalibur's 50% passive and the card shows the die beside "+25 Light" (#230 EX.p), as it shows every other die (Ch. 13, #190).
**Actual:** stage 7 read "Excalibur: Sword of Promised Victory (light) 25"; the card's Rolls list was empty. A LOST die says "rolled 51 vs 50%" in the breakdown; a won one said nothing anywhere.
**Cause:** `module/rules/roll-log.mjs:194 @ uncommitted` — `modifierDiceRecords` files `m.roll` dice only, and matched a contributor's note exactly; the `FlatDamage` `chance` I built for the passive rolls under `m.chance.key`, and its note carries the element, "(light)".
**Fix:** `module/rules/roll-log.mjs#modifierDiceRecords @ uncommitted` — a chance die is filed when its bonus landed ("1d100 → 40, against 50%"), the note matched with its element beside it. Test in `arturia-230.test.mjs`.
