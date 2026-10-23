---
id: 2026-10-22-form-kept-derived-magus
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** the Gigantic Horror's Attributes are exactly Dark, Outsider and Large (#323 reading 11c); the unit
test checked they were present and that Humanoid was gone.
**Actual:** live, its board unit held `["dark", "large", "magus", "outsider"]`.
**Cause:** `module/rules/snapshot.mjs:308 @ d97795b9` — the form's Attributes went through `closeAttributes` with his
Caster Class, which derives Magus. A second reader, the option set that gates his own passives
(`contributionsOf`, :2007), closed his authored Attributes and never saw the form at all.
**Fix:** `module/rules/snapshot.mjs:1876 @ uncommitted` — `attributesOf`, the one reader both sites call: a form's
Attributes replace the set with nothing derived beside them; the test asserts the exact set from both.
