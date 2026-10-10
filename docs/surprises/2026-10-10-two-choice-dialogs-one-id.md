---
id: 2026-10-10-two-choice-dialogs-one-id
found: live press
kind: fixed-id-singleton-window
status: fixed
reviewed: false
---
**Expected:** pressing Zero Sail with two enemies within 3 panels asks each of them "Attempt to enter?",
then submerges.

**Actual:** only Karna's prompt showed. After answering it nothing happened: no Storm Border, no roll, no
card, Nemo still on the ground. The Skill's use was still waiting on Achilles' answer.

**Cause:** `module/apps/choice-dialog.mjs:18 @ 08ea4b1` — every `ChoiceDialog` carries the fixed id
`fgt-choice-dialog`. `askAttempts` asks all enemies at once (`module/engine/dimension.mjs`, `Promise.all`),
and with no player connected every question lands on the GM's client, where the second window with the
same id is not a second window. Its promise never settles.

**Fix:** `module/apps/choice-dialog.mjs:19 @ d162f50` — each dialog gets its own id.
