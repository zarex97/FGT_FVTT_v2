---
id: 2026-10-19-conquest-said-nowhere
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** reviewing #179, a Conquest that moves a Servant to the killer's side is something every player is told, and a refused one too: the code's own comment says a refusal is logged *"because the ABSENCE of a contract here is a rule and a player will otherwise assume the system missed it."*
**Actual:** the faction write held (Yan Qing in `faction-2` under Saber's Master), and the chat log said only *"Master of Assassin of Red is defeated by Saber."* Player1's Servant was on Blue's roster with no line naming it. A refused Conquest wrote a log entry and no card.
**Cause:** `module/engine/io.mjs:1883 @ 856a58ff` — `resolveConquest` wrote the contract and recorded game-log entries, read by nobody on screen.
**Fix:** `module/engine/io.mjs:1978 @ a87324ca` — `conquestCardContent` builds a public card naming the Servant, its new Master, its side and the Command Spells, or the refusal's reason; posted at `module/engine/io.mjs:1181 @ a87324ca`, after the defeat card. Pressed live 2026-10-19: *"Conquest: Assassin is now contracted to Caster and fights for Blue. Caster gains 3 Command Spell(s) usable only on Assassin."*
