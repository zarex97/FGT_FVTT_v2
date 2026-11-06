---
id: 2026-10-15-skipped-damage-hid-effects
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Gáe Bolg Alternative's card says it Stunned and Instakilled.
**Actual:** the card showed only the ladder; the `effects` flag held "Stun" and "Instakill: rolled 7 vs 75%".
**Cause:** `module/apps/chat/cards.mjs:86 @ 7005d25` — the viewer's visibility was built only from a damage result, and an Instakill skips the damage step.
**Fix:** `cards.mjs @ 79877ec` builds it from the effects alone; `templates/chat/attack.hbs` gates the damage block on `result`.
