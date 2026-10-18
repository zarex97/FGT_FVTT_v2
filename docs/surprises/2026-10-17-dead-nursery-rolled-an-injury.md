---
id: 2026-10-17-dead-nursery-rolled-an-injury
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** A Unit an attack defeats rolls no Injury: *"a defeated one has no Agility left to lose"* (`rules/injury.mjs`).
**Actual:** Excalibur defeated her; the Glass Game's effect 2 wrote her Health back to 350, as *"she stays defeated"* allows; her card then read *"635 Injury Roll required"* and the log held `injury … amount 2` on her.
**Cause:** `module/rules/injury.mjs#injuryCheck @ eebbb988` judged defeat by `healthAfter <= 0` alone, read after the defeat step, which is where effect 2's rewind runs.
**Fix:** `module/rules/injury.mjs#injuryCheck @ uncommitted` also asks `defender.defeated`; `nursery-247-rulings.test.mjs` checks a defeated defender at 350 Health.
