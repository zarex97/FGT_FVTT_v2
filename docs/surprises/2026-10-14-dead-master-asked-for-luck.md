---
id: 2026-10-14-dead-master-asked-for-luck
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** Brahmastra Kundala overpowers the Master of Lancer of Faction 2 and its Process ends: the card shows 1542 and the Burn and Def Dwn (B) riders.
**Actual:** the card stayed at "Choose a reaction" and the Awaiting panel at "0:00". The GM's screen held "Contest with a Luck Check? Master of Lancer of Faction 2 may make a prevention Luck Check", once per rider, for a Master already at 0 Health and defeated.
**Cause:** `module/engine/landing.mjs:404 @ 7333e08` — `offerPrevention` asked any target with Luck, and a rider lands after the damage that defeated it. A GM-owned Unit's question is a local dialog with no deadline, so the Process waited on it; the card is only rewritten when the rung's answer finishes.
**Fix:** `module/engine/landing.mjs:414 @ 95b91ea` — not offered to a defeated Unit, read off the live document; `test/unit/prevention-luck-check.test.mjs` failed first on "A question nobody scripted was shown to p1". The stale card while a Process waits on a question inside a rung stays open.
