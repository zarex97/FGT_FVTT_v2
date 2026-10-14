---
id: 2026-10-14-field-chance-rolled-twice
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Contagion rolls one d100 per chance and subtracts the target's resistance once.
**Actual:** Four d100s for two chances: the field rolled its own, then the adapter rolled a second against the effect's `baseChance` and met resistance there.
**Cause:** `module/engine/fields.mjs:1456 @ a436802` — the field's die and chance were not forwarded on the intent.
**Fix:** `module/engine/fields.mjs:1488 @ uncommitted` — the field forwards `chance` and `rolled`; Landing uses that die.
