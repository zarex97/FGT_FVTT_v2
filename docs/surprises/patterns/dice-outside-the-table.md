---
kind: dice-outside-the-table
lesson: Every die the game rolls is a Foundry Roll, so the card, the log and a scripted test can see it.
landed: none
---
**Mechanism:** A die rolled with `Math.random` decides the game and leaves no trace: no roll record on the card, nothing in the log, and a test world that scripts its dice cannot reach it. Suppression's removal die and Medea's Trofa coin against a Noble Phantasm were both rolled that way.
**Lesson:** Roll every die with `new Roll(...)`. `test/unit/dice-through-roll.test.mjs` refuses `Math.random` in `module/` outside the places it lists as not dice.
**Surprises:** [2026-10-14-strip-rolled-outside-the-dice](../2026-10-14-strip-rolled-outside-the-dice.md)
