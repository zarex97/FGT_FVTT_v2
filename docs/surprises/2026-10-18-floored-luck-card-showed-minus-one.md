---
id: 2026-10-18-floored-luck-card-showed-minus-one
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** a Normal Lancer whose Luck die came up 1 shows Max Luck 0 on the wizard card, with arithmetic that reaches 0.
**Actual:** live, `prepareSummon` floored the value to 0, but the card's arithmetic read "-2 + 1 (1d20)" beside the 0: an answer its own working does not reach.
**Cause:** `module/apps/summon-present.mjs:36 @ 3d1a6d59` — `describe` rebuilds the arithmetic from `base` and `applied` itself, a second reader of the line's sum, and knew nothing of the new `min`.
**Fix:** `module/apps/summon-present.mjs:46 @ e5c31ff9` — when the floor bit, the working ends "→ floored at 0". Live on the wizard's Servants tab: "Max Luck 0 · -2 + 1 (1d20) → floored at 0". `test/unit/summon-present.test.mjs`.
