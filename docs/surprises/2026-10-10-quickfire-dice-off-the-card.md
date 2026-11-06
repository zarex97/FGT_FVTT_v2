---
id: 2026-10-10-quickfire-dice-off-the-card
found: live press
kind: recorded-not-rendered
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Quickfire's card lists its 6d6 and every threshold modifier, fired or not —
`module/rules/damage/dice-count.mjs` exists so a player handed "you dealt 75" can check it.

**Actual:** the breakdown read "6 of 6 dice at 2+" and the card had no Rolls section at all.

**Cause:** `module/engine/attack.mjs:1565 @ 50c5731` wrote the record to `state.rollLog`; the card renders
`state.rolls` (`module/apps/chat/cards.mjs:167`), which `rollRecords` fills.

**Fix:** `module/engine/attack.mjs @ efd49e2` — the threshold record rides `result.modifierRolls` into
`rollRecords`, beside the modifier dice.
