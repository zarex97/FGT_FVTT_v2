---
id: 2026-10-25-shove-table-ignored-attacker
found: user
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Ruled 2026-10-25: the shove's *"Agility Check/Agility Check-"* is read against the attacker, the
comparison the guard's *"Agility Check (against the AU)"* already makes.
**Actual:** The shove read favourable whatever the attacker's Agility; the guard's step-in compared the two.
**Cause:** `module/engine/attack.mjs:2742 @ cc1d8e41` — `resolveCover` passed `favourable` unless an effect forced
the other; `engine/master-guard.mjs` asked `tableFor` itself. Two readers of one check.
**Fix:** `module/rules/checks.mjs#agilityTableAgainst @ d3452f94` — both ask it. Test:
`test/unit/cover-shove-press.test.mjs` (an 8 against Drake's 10 fails when EMIYA is quicker).
