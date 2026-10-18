---
id: 2026-10-18-luck-contest-offered-where-removed
found: live press
kind: two-readers-one-rule
status: open
reviewed: false
---
**Expected:** on Intermediate difficulty ("the Luck Check removed") a defender who failed to Evade is never asked to contest with Luck.
**Actual:** Player1's card showed "Contest with a Luck Check?" with "Contest (costs 1 Luck, have 17)" and "Decline", "Waiting for Contest with a Luck Check? (0:11)"; seconds later the ladder read `s24_luckyEvasion → declined`.
**Cause:** `module/engine/attack.mjs:3901 @ b7005fed` — the difficulty is read only when the rung is ANSWERED (`luckChecksApply` → `declined`, reason `luckChecksRemoved`); the card's prompt (`process.pendingPrompt`) does not read it, so the offer shows a choice its press cannot take.
**Fix:** open. The prompt should skip the rung, or the Process advance past it before the card renders.
