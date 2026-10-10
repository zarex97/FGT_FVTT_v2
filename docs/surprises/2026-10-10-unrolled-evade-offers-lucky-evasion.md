---
id: 2026-10-10-unrolled-evade-offers-lucky-evasion
found: live press
kind: override-takes-the-generic-edge
status: fixed
reviewed: false
---
**Expected:** Karna choosing Evade against Quickfire rolls nothing and avoids nothing; the threshold rises
to 6 and the hit lands.

**Actual:** the threshold rose ("0 of 6 dice at 6+"), and then the ladder ran `evadeRoll → fail →
s24_luckyEvasion → declined → s23_acceptOrEscape`: a Luck Check to evade anyway, and a Command Spell
escape, both offered for an Evade the sheet says never happened. A passed Lucky Evasion leads to
`noDamage`.

**Cause:** `module/engine/attack.mjs:1350 @ 08ea4b1` advanced the override as an ordinary `fail`, and
`module/engine/combat-process.mjs:46` sends every failed Evade to Lucky Evasion.

**Fix:** `module/engine/combat-process.mjs:47 @ d162f50` — an `evadeRoll:overridden` edge to
`damage`, which the override advances on.
