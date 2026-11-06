---
id: 2026-10-26-prevention-offered-to-the-instakilled
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** Ch. 13: the Prevention Luck Check is *"not offered … with no Luck"*. A Unit Instakill has just taken to 0
is offered nothing.
**Actual:** Pressed as Player1 in War `FwdFxnFteJ3xFCax`: Barbed Spear's Luck Check failed (*"Luck Check 15 vs 1:
failure"*), Instakill took Medusa to 0, and the GM was then asked *"Medusa may make a prevention Luck Check. It costs 1
Luck whether or not it succeeds (0 left). Yes No"* against Curse (Bolg).
**Cause:** `module/engine/landing.mjs#offerPrevention @ 901bea6d` — not traced yet. The check phase spent her one Luck
and Instakill landed in the same `beforeDamage` pass; the offer appears to read a board taken before either write.
**Fix:** `module/engine/landing.mjs#offerPrevention @ 5ed93116` — reads the live document's Luck and Health (#339
ruling 36). Test: `cu-chulainn-339.test.mjs`, one Luck spent by the check, then Instakill: no question.
