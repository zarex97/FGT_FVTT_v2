---
id: 2026-10-22-gate-reason-shown-raw
found: live press
kind: unknown-value-falls-to-default
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** inside the Storm Border, Player1's bar says in words why the Gigantic Horror is refused.
**Actual:** the tooltip read "Prelati's Spellbook: Gigantic Horror — forbidCreating".
**Cause:** `module/apps/actor-sheet/present.mjs:266 @ ce40e2d7` — `abilityState`'s default branch builds
`FGT.Ability.Refused.<reason>`, and `lang/en.json` had no string for the use gate's own `forbidCreating` or
`normalAttacksOnly` (`rules/costs.mjs`). The i18n guard walked `REQUIREMENT_KINDS` only, never the gate's reasons.
**Fix:** `lang/en.json @ 0c5e1ad7` — both strings; `test/unit/i18n.test.mjs` "has a label for every reason the use
gate returns" scans `costs.mjs` and `ability-use.mjs` for every reason literal.
