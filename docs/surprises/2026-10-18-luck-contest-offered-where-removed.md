---
id: 2026-10-18-luck-contest-offered-where-removed
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** on Intermediate difficulty ("the Luck Check removed") a defender who failed to Evade is never asked to contest with Luck.
**Actual:** Player1's card showed "Contest with a Luck Check?" with "Contest (costs 1 Luck, have 17)" and "Decline", "Waiting for Contest with a Luck Check? (0:11)"; seconds later the ladder read `s24_luckyEvasion → declined`.
**Cause:** `module/engine/attack.mjs:3901 @ b7005fed` — the difficulty is read only when the rung is ANSWERED (`luckChecksApply` → `declined`, reason `luckChecksRemoved`); the card's prompt (`process.pendingPrompt`) does not read it, so the offer shows a choice its press cannot take.
**Fix:** `module/engine/attack.mjs:3908 @ a87324ca` — `closedLuckRung` is the one reader: the drive runs through a closed Luck rung before the card is drawn, the Contest press and a Command Spell's resume decline it, and the card prints why (#252). Pressed live 2026-10-19: Player1's card read "No Luck Check: this War's difficulty removes it." and went straight to Accept.
