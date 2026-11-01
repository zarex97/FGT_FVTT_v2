---
id: 2026-10-31-bar-not-reader-of-unaffectedby
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Face of the King's `unaffectedBy: [skillSeal]` would light its button under Skill Seal: the use gate, the press gate and the bill all passed it.
**Actual:** The action bar greyed it "Face of the King — prevented by Skill Seal"; the unit test, which called `useSkill`, passed.
**Cause:** `module/apps/hud/action-bar.mjs:181 @ fe7e8891` asked `budget.affordable` with no `ignoring`: the bar is a fourth reader of the Seal gate.
**Fix:** `module/apps/hud/action-bar.mjs @ 0c363285` passes the item's `unaffectedBy` to `afford`.
