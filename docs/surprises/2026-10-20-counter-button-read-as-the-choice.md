---
id: 2026-10-20-counter-button-read-as-the-choice
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** I said Summoning: Horrors was refused as a Counter by a use gate: the bar read "Available as a Counter", and a press of it gave "Summoning: Horrors — Only during your Turn."
**Actual:** No gate refused it. Pressing the card's "Counter" button had already declared a Counter with a Normal Attack (cards r3Qx0pqjkr9d1p1L, zrHvPCegiuSexE1s), the bar disarmed, and the slot then greyed for the enemy's Turn, correctly. Pressed from the bar alone, it worked.
**Cause:** `module/apps/chat/cards.mjs:414 @ 48916996` — the button sends the rung's `counter` event with no ability, so it is a Normal Attack Counter, and it was labelled only "Counter". A player reads it as the door to the choice, as I did, while the bar still glows.
**Fix:** `lang/en.json:267 @ ca41d4ab` — the button reads "Counter with a Normal Attack", and its hint sends an ability to the glowing action bar. Ch. 21 Step 6 says both ways.
