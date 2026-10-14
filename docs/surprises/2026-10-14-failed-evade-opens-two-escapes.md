---
id: 2026-10-14-failed-evade-opens-two-escapes
found: test
kind: generic-path-escapes-special-case
status: fixed
reviewed: false
---
**Expected:** Making Gate of Skye's Evade fail automatically (an empty `evadableOnlyBy` permit) leaves its Luck Check the only way to avoid it, as ruled (#204 reading 15).
**Actual:** The arena test, after the failed Evade, was asked `s24_luckyEvasion` and then `acceptOrEscape: ["accept","cs"]`. Lucky Evasion and the Command Spell escape both lead to `noDamage`.
**Cause:** `module/engine/combat-process.mjs:46 @ 4983091` — `evadeRoll:fail` goes to Lucky Evasion and then the escape rung; a failed Evade opens two more avoidances the Gate's sheet rules out.
**Fix:** `module/engine/attack.mjs:1081 @ cde0483` — an `unavoidable` attack closes the Evade rung at declaration, which closes both; a guarded Master's shove is offered when it answers instead.
