---
id: 2026-10-12-unremovable-instance-cleansed
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Self-Suggestion's cleanse leaves an Unremovable debuff, as its YAML comment says.
**Actual:** the staged Unremovable Atk Dwn went with Burn and Def Dwn.
**Cause:** `module/engine/skill-use.mjs:1965 @ 50c5731` read `def.unremovable ?? instance`; the registry says `false`, never `null`, so the instance's flag was never read. `attack.mjs` had the same line.
**Fix:** `module/rules/removal.mjs:49 @ 81c5732` — one `isUnremovable`, both paths.
