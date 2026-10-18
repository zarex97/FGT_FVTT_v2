---
id: 2026-10-18-ally-area-offered-jack-preemption
found: live press
kind: relation-qualifier-unread
status: fixed
reviewed: false
---
**Expected:** *"Whenever Jack is Attacked by an enemy Unit … Jack can Attack first instead"*: an ally's area that catches him offers nothing.
**Actual:** Danzō's Dongyū (Concealment), which conceals her allies, asked Player1 *"Attack first? Katō Danzō has declared an Attack on Jack the Ripper. Murderer of the Misty Night lets Jack the Ripper Attack first instead."*
**Cause:** `module/engine/attack.mjs#offerPreemption @ dfcaa421` — it checked the pre-empter's Range and nothing about who attacked. Jack's sheet's "enemy" was in the element's comment, not in the code. Until an ally's area could catch him, every attacker had been an enemy.
**Fix:** `module/engine/attack.mjs#offerPreemption @ dfcaa421` — an attacker that is not the pre-empter's enemy is skipped. An arena test fails without it, on the unscripted question.
