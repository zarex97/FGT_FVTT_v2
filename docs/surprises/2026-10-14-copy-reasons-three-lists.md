---
id: 2026-10-14-copy-reasons-three-lists
found: test
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Adding the copy reason `named` to the DataModel's choices and to `COPY_REFUSALS` lets content author it.
**Actual:** `npm run validate:content`: `copyable.allowed is false with reason "named" — expected one of physical, unique, classSkill, rankEX`, four errors. The suite was green.
**Cause:** `tools/lib/content.mjs:145 @ 4983091` — the validator kept its own copy of the reason list, a third beside `module/data/item/ability.mjs:281` and `module/rules/copy.mjs:27`.
**Fix:** `module/domain/enums.mjs @ cde0483` — one `COPY_REASONS`, read by all three.
