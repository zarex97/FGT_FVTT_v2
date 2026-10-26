---
id: 2026-10-25-no-evade-no-cover
found: user
kind: rule-word-read-one-way
status: fixed
reviewed: true
pattern: rule-word-read-one-way
---
**Expected:** Ruled 2026-10-25: *"gets caught in an AoE Noble Phantasm and fails to Evade"* covers every answer but a
successful Evade, so a Master who does nothing or Blocks is shoved or covered too.
**Actual:** Cover ran only after a failed Evade roll, or an Attack nobody may Evade. A Master who answered Do nothing
took the blast with its Servant beside it.
**Cause:** `module/engine/attack.mjs:2107 @ cc1d8e41` — `answerRung` called `resolveCover` from the Evade branch and
for `unavoidable` only; "fails to Evade" had been read as "rolled an Evade and failed".
**Fix:** `module/engine/attack.mjs @ d3452f94`, `answerRung` — Do nothing and Block call `resolveCover` too. Test:
`test/unit/cover-shove-press.test.mjs`.
