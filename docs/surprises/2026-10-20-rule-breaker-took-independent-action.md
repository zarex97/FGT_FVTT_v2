---
id: 2026-10-20-rule-breaker-took-independent-action
found: live press
kind: rule-word-read-one-way
status: fixed
reviewed: true
pattern: rule-word-read-one-way
---
**Expected:** Independent Action with Viy EX: *"Cannot be contracted by enemy Casters and Masters"* — absolute (Ch. 45 Q48; pressed as `IA.3`, the Contract window refuses Medea).
**Actual:** card xeEWNPBSY20lAeFO, Medea's Rule Breaker on Anastasia, no reaction: the log reads `contract ruleBreaker … toMasterId: Medea`, and Anastasia's `masterId` became Medea's: an enemy Caster now holds her Contract.
**Cause:** `module/engine/attack.mjs#cutContract @ 50eae993` — Rule Breaker's *"the Contract … is given to Medea"* never asks `rules/contract.mjs#rollsRequired`, the reader of Independent Action's prohibition. Which wins, and whether the cut still frees her, is a reading for the user.
**Fix:** ruled 2026-10-20 (#258 reading 12): Rule Breaker's gift stands; Independent Action is meant against the normal Contract option, or Conquest. Pressing that, Conquest never asked it either: `module/rules/contract.mjs#conquestContract @ 0552085c` leaves an EX or A+ Servant out of the claim, Free, with a card line; pressed live (Medea killed her Master: *"No Conquest: Archer's Independent Action refuses Caster's side, and Archer is Free."*).
