---
id: 2026-10-18-pc5-ended-pc-the-attack-landed
found: test
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** reading 41: Kawarimi into her own Dongyū (Concealment) leaves her with its C+. PC.5 is *"after an Attack while PC is Active"*, and she was not concealed when she declared it.
**Actual:** the Process recorded *"Presence Concealment applied"* on her, and she held none after it. Nothing said it ended.
**Cause:** `module/engine/attack.mjs#endConcealmentAfterAttack @ dfcaa421` — PC.5 ended the attacker's PC at the Process's end, reading the clock as it stood then, not at declaration.
**Fix:** `module/engine/attack.mjs#resolveAttack @ dfcaa421` — the spec records `concealedAtDeclaration` once the price is paid, and PC.5 returns when it is false.
