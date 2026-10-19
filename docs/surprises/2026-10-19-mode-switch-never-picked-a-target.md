---
id: 2026-10-19-mode-switch-never-picked-a-target
found: live press
kind: passes-for-the-wrong-reason
status: fixed
reviewed: true
pattern: passes-for-the-wrong-reason
---
**Expected:** Player1 switching Doppelganger on from the bar opens a targeting session for the look, as the arena tests (green) said the mode worked.
**Actual:** no session opened; the bar showed "Doppelganger cannot be used: Choose a target..". The arena tests called `useSkill` with the placement already in hand, the part the sheet's switch is supposed to supply.
**Cause:** `module/rules/ability-use.mjs#needsTargeting @ 27ef5aa0` answered `false` for every mode, so `apps/actor-sheet/sheet.mjs#toggleMode`'s new pick never ran and relayed `{}`.
**Fix:** `module/rules/ability-use.mjs#needsTargeting @ cce1f438` — a mode with a `targeting` declaration is asked like any Skill; the arena test asks `needsTargeting` of the real Doppelganger, the sheet's own question.
