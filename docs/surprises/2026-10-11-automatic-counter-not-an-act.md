---
id: 2026-10-11-automatic-counter-not-an-act
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** in Holder Mode, Mannanán gains a token at the end of a Turn she Acts. A Counter is an Act (#107, and #195 reading 12), and she countered four times on Faction 2's Turn.
**Actual:** tokens stayed at 0 through that Turn's end. Her turn record read `acted: false` throughout.
**Cause:** `module/engine/attack.mjs:3625 @ 75ae578` — only the ordinary counter path (`runCounter`) stamps `acted`. `flushAutoCounters` and `resolveNPCancellation` declare on her behalf through other doors and stamped nothing. Three paths answer "did this Unit act", and only one wrote the answer.
**Fix:** `module/engine/attack.mjs @ 57c23ae` — both stamp `markTurn(…, { acted: true })`. `test/unit/mannanan-197.test.mjs` holds both.
