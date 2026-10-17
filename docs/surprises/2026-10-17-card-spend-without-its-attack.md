---
id: 2026-10-17-card-spend-without-its-attack
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Heaven's Feel, offered on Pollux's Noble Phantasm card, is spent when Player1 presses it.
**Actual:** *"FGT | Command Spell refused: attackIsNP"*, from the button the card had just shown.
**Cause:** `module/engine/command-spells.mjs:155 @ uncommitted` — the offer (`processOffers`) asks the
requirements with the Process's `state` and `attack`; the spend built its context from the click's
payload alone, which carries neither. Two readers of one requirement list, and the second asked a
different question: `attackIsNP` refused, and `attackIsNotNP` let Damage Up through on an NP.
**Fix:** `module/engine/command-spells.mjs:155 @ uncommitted` — a spend on a card reads the card's
Process first and asks with its rung and attack.
