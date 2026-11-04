---
id: 2026-11-04-sheet-refusal-drops-placeholders
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** `usage.detail` carries `{amount, held, pool}`, so the sheet reads *"Needs 7 Eater Tokens; 0 held."*
**Actual:** Player1's sheet read *"Needs undefined undefined; undefined held."*
**Cause:** `templates/actor/ability-card.hbs:45 @ ff814c4b` — both `localize` calls list their placeholders by hand, without `by`, `names`, `amount` and seven others the refusals print.
**Fix:** `templates/actor/ability-card.hbs @ 96edc10a` — both pass all of them, and `test/unit/kazuradrop-world-385.test.mjs` walks the strings against the template.
