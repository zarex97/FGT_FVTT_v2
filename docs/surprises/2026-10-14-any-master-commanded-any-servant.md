---
id: 2026-10-14-any-master-commanded-any-servant
found: live press
kind: role-keyed-on-type
status: fixed
reviewed: false
---
**Expected:** An attack card offers a Master the Command Spells it may spend on that attack.
**Actual:** Nemo's attack on the Master of Lancer of Faction 2 showed "Damage Block 1 CS" four times, once per Faction 2 Master, and Teleport Servant to Medea's Master with Medea defeated and gone. Every command acted on whichever Servant the board listed first.
**Cause:** `module/apps/chat/cards.mjs:327 @ 4983091` — the offer asked whether a Unit was a Master in the match, never whose Servant the attack was about; `contextFor` took the first Servant with that `masterId`, defeated or not.
**Fix:** `module/engine/command-spells.mjs#processOffers @ uncommitted` — ruled 2026-10-14: a command serves its Master's own live Servant, only on an attack that Servant is in when it changes the attack, and the one the Master names.
