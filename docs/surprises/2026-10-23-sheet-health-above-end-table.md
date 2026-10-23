---
id: 2026-10-23-sheet-health-above-end-table
found: test
kind: rule-word-read-one-way
status: fixed
reviewed: false
---
**Expected:** U-Olga Marie's Max Health is her sheet's *"Base Health: 2500"* (ST.hp).
**Actual:** 2000. Her END is EX, and `baseHealthByEnd` gives EX 2000; the table beats the sheet.
**Cause:** `module/domain/health.mjs:127 @ d24c003e`: `maxHealthFor` takes the END table whenever there is an END rank.
Its note records four sheets that disagree, all *downward*; hers is the first that disagrees upward, by 500.
**Fix:** ruled by the user, 2026-10-23: *"Her health should be 2000"*. The table beats the sheet upward too; nothing
changed. `max-health-derivation.test.mjs` names her beside the four.
