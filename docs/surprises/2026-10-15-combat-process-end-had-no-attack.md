---
id: 2026-10-15-combat-process-end-had-no-attack
found: test
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** the Circuits could hang "each Attack he performs ... at the end of its Combat Process" on
`combatProcessEnd`, which fires hit or miss.

**Actual:** `combatProcessEnd` is raised on both combatants with `options: new Set()`: no attack, and no way to ask
whether the hearer performed it or took it. `damageStepEnd` carries the attack and fires on a hit only, so a miss reached
neither.

**Cause:** `module/engine/attack.mjs:1859 @ 7231295` — the event was written for Vasavi Shakti's upkeep, a clause with no
predicate.

**Fix:** `module/engine/attack.mjs:1886 @ uncommitted` — the attacker hears it with the attack's options and
`attack:performed` (`module/rules/options.mjs @ uncommitted`); the defender hears it as before.
