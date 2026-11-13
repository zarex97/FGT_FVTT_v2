---
id: 2026-11-13-kind-pinned-as-proof-of-active
found: test
kind: passes-for-the-wrong-reason
status: fixed
reviewed: true
pattern: passes-for-the-wrong-reason
---
**Expected:** Serenity's test *"is an ACTIVE skill with a duration, not a mode"* checks activity.
**Actual:** It asserted `kind: "skill"`, which says nothing of activity; it failed when Presence Concealment became a Class Skill.
**Cause:** `test/unit/serenity.test.mjs:86 @ 6315e1e`: the kind stood in for the keys that decide it, `passive` and `isMode`.
**Fix:** `test/unit/serenity.test.mjs:86 @ 143a925`: asserts `isMode` falsy and `passive` unset, beside the ruled kind.
