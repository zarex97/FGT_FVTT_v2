---
id: 2026-10-20-damage-taken-rolled-no-dice
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** a chance on a `damageTaken` handler rolls, as one on `damageDealt` does.
**Actual:** Soaked's new 25% Freeze never fired at any face: `anastasia-258-rulings.test.mjs` *"freezes a Soaked Unit on a roll of 30"* stayed red with every d100 at 30.
**Cause:** `module/engine/attack.mjs:3245 @ 50eae993` — `fireDamageTaken` passed `rolls: {}`, and `scheduler.mjs#chanceGatePasses` refuses an action whose die never arrived. `fireDamageDealt` was fixed for exactly this (Drake's 15%) and its mirror was not.
**Fix:** `module/engine/attack.mjs#fireDamageTaken @ uncommitted` — rolls through `rollChances` and files the dice on the card, as `damageDealt` does; its options say `attack:dealtDamage` too.
