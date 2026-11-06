---
id: 2026-10-22-actions-ended-named-by-id
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** every reader of a prevention names its source in words, as `budget.mjs#preventerName` does for the sheet and the movement notice.
**Actual:** after Test Use: Spell failed with `then: endActions`, Player1's bar tooltip and press banner read *"Test Use: Plain Skill — prevented by actionsEnded"*.
**Cause:** `module/rules/budget.mjs:311 @ f0698a2c` — `canConsume` built its own name from the effect registry, a third reader `preventerName` (written for this case) did not replace.
**Fix:** `module/rules/budget.mjs#canConsume @ 90cde841` — it calls `preventerName`; `use-failure.test.mjs` asserts the words, red before.
