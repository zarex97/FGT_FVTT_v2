---
id: 2026-11-19-removal-took-the-unremovable-twin
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** a removal leaves an Unremovable instance alone, whatever else of its definition it takes (#198: the
instance's own `unremovable` counts).

**Actual:** reproduced in fgt2026 on 2026-11-19 (R-0032 in the Godot port): Faction 2's Saber held two Atk Ups, one
landed Unremovable. The Attack path's removal planned `["atkUp"]` and wrote `removeEffect(saber, "atkUp")`, and
neither Atk Up was left. The Skill path wrote the same.

**Cause:** `module/rules/removal.mjs:78 @ uncommitted`: both paths wrote the plan's definition ids, and
`io.mjs#deleteEffects` matches a definition id as well as a document id, so the twin went with the removable one.

**Fix:** `removalCandidatesOf` builds both paths' candidates with each instance's document id, and `removalTargets`
names the removable instances to write. On the fix, the same board left the Unremovable Atk Up.
`test/unit/removal-twin.test.mjs`.
