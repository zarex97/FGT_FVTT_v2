---
id: 2026-10-16-roll-lines-named-the-true-name
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** a concealed Arturia is "Saber" on every line of an attack card the table reads (Ch. 30).
**Actual:** the header read "Lancer ⚔ Saber" and the roll lines under it "Arturia's Instinct: 50 against 70%" and, before that, "Medusa evades Arturia". A public GM line read "Arturia stands next to Master of Saber of Faction 1: the Attack is changed to Arturia." And an ally's reaction offered on Karna's card read "Avalon: The Everdistant Utopia (Arturia)".
**Cause:** `module/engine/attack.mjs:3500 @ b4464ed` — the card's header asks `publicIdentityOf`, and the four roll records (`evades`, `contests`, a rider, Instinct) wrote `unit.name`; a roll record ships on the card every client reads. `engine/master-guard.mjs#report` did the same with `guard.name`.
**Fix:** `module/engine/attack.mjs#shownName @ uncommitted` — every roll line names its Units through `publicIdentityOf`, and so do the Master-guard line (`engine/master-guard.mjs#shownName`) and an ally's offered reaction (`attack.mjs#offeredReactions`); arena tests check both against the public name.
