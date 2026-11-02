---
id: 2026-11-02-instakill-rolled-with-no-mental-debuff
found: live press
kind: qualifier-quoted-not-checked
status: fixed
reviewed: false
---
**Expected:** Nirmānnarati rolls no Instakill for a DU with no Mental Debuff (#372 reading 19, *"X=(20\*number of Mental Debuffs on the DU)"*), and the unit test for that DU checked only the missing multiplier.
**Actual:** Pressed live as Player1 over Cú, Medea and Arjuna: *"Instakill: resisted, rolled 53 vs 0%"* on Medea and *"rolled 23 vs -15%"* on Arjuna. Neither held a Mental Debuff. A die was rolled and printed for a chance the sheet makes zero.
**Cause:** `module/engine/landing.mjs:140 @ 83af213a` — `chanceBonus` adds `per × count` to the stated chance and always lands the entry. At a count of 0 the chance is 0 or less, and the die is still thrown. The reading's excluded case had no guard and no test.
**Fix:** `module/engine/landing.mjs:120 @ d1077f8a` — `chanceBonus.countedOnly` lands nothing and rolls nothing when its Count finds none, with the reason *"nothing to count"*. Nirmānnarati's entry states it.
