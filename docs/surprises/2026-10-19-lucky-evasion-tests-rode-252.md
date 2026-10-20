---
id: 2026-10-19-lucky-evasion-tests-rode-252
found: test
kind: passes-for-the-wrong-reason
status: fixed
reviewed: false
---
**Expected:** closing the Luck rung on Intermediate (#252) changes only the new test's outcome; the suite has no test that plays a Lucky Evasion on Intermediate.
**Actual:** two arena tests went red: `danzo-249-arena` *"is not evaded by Dodge or an Evade, only by Lucky Evasion"* failed `Illegal Combat Process transition "s23_acceptOrEscape:success"`, and `arturia-230-arena`'s Instinct test `"s23_acceptOrEscape:declined"`. Both ran on the War Rules' default difficulty, Intermediate, and scripted an answer to the Lucky Evasion rung; Danzō's `contest` ROLLED a Luck Check Intermediate removes.
**Cause:** `test/unit/danzo-249-arena.test.mjs:395 @ 856a58ff` — the arena's `MATCH` names no difficulty, so `warRule("difficulty")` read its initial `intermediate`, and the test passed only because #252's defect still offered the rung.
**Fix:** `test/unit/danzo-249-arena.test.mjs @ uncommitted` runs on Expert, where Lucky Evasion exists; `test/unit/arturia-230-arena.test.mjs @ uncommitted` drops the answer to a rung Intermediate no longer asks.
