---
id: 2026-10-29-stored-card-offers-gm-buttons
found: live press
kind: two-readers-one-rule
status: open
reviewed: false
---
**Expected:** `templates/chat/attack.hbs:151`: the Command Spell prompt is "only shown when this viewer owns a Master
that can actually spend one", and its "No Command Spell" passes "this player's Masters" (`module/apps/chat/cards.mjs:711`).
**Actual:** on every Attack that offered a Command Spell, Player1's page first showed a "No Command Spell" naming
`dz9ACY9QTmg0XqXE,pnjX0j90nKcA3iLk` (her Master and Asterios's) beside Teleport Servant, a Faction 2 command; pressed,
the GM answered "Player1 does not hold that Master." A second later the card redrew with her Master alone.
**Cause:** `module/apps/chat/cards.mjs:194 @ 03883e1` — the stored card is rendered on the GM, who owns every Master, so
`offerableCommands` and `passFor` read the GM's ownership; each client redraws it for its viewer only after the
template renders, and a slow client (1–3 FPS in a headless browser) shows the GM's buttons until then.
**Fix:** open — #356: the stored card should carry no viewer's Command Spells.
