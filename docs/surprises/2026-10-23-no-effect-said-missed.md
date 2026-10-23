---
id: 2026-10-23-no-effect-said-missed
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** EMIYA's Normal Attack on U-Olga Marie from 4 panels, a BA(STR) swing, has no effect on her, and the
card says so and why (#328 ruling 9: "no damage, no riders, a card line").
**Actual:** pressed live 2026-10-23, Round 40: the card read *"Missed — the attack did not happen."* The Process
held the reason as a `noEffect` roll record, *"The Attack has no effect on Beast: Gravity Manipulation."*, and
nothing drew it. A player would read Blind.
**Cause:** `module/apps/chat/cards.mjs:123 @ 7f02a2c2`: the card's context took the `miss` roll alone, and
`templates/chat/attack.hbs:20` printed `FGT.Card.Missed2` for any `missed` Process.
**Fix:** `module/apps/chat/cards.mjs @ 7f02a2c2`: `noEffect`, the record's label, and the template prints it in
place of "Missed". `olga-328.test.mjs` "a STR Attack from 4 or more panels" was red first on the card's data.
