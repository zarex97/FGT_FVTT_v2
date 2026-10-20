---
id: 2026-10-19-preemption-said-nowhere
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** pressing #134 live, Jack's pre-emption by Murderer of the Misty Night tells both players that Jack swings first and what it cost: the Luck Check it charged by Day.
**Actual:** Jack's Luck went 2 → 1 and a Process *"Assassin ⚔ Caster"* appeared on the chat log, with no line saying why; the Luck Check reached the game log only (`check / preemptLuck`). Its prompt read *"Medea has declared an Attack on Jack the Ripper"* to Jack's player, Medea's true name across the table.
**Cause:** `module/engine/attack.mjs:8380 @ 856a58ff` — `preemptionLuckCheck` wrote the stat and a log entry and returned a boolean; the prompt's hint used `defenderDoc.name` and `attackerDoc.name`.
**Fix:** `module/engine/attack.mjs#postPreemptionCard @ uncommitted` — a public card for every pre-emption taken, with the phase and the Luck Check; the hint uses `shownName`. Pressed live 2026-10-19: *"Assassin Attacks first instead of Caster (Murderer of the Misty Night). Assassin stands in Night: no Luck Check."*
