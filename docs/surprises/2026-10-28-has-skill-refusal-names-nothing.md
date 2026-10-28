---
id: 2026-10-28-has-skill-refusal-names-nothing
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** With Martial Blessing gone, the ten Vishnu Bhuja slots would say which Skill they wait on.
**Actual:** Player1's bar read "Requires a Skill this Unit does not have." on every slot.
**Cause:** `module/rules/items.mjs:726 @ 02fe93eb` — `requirementDetail` named the effect or ability for three kinds and nothing for `hasSkill`; the Skill is the one thing the Unit lacks, so its name cannot be read off the Unit.
**Fix:** `module/rules/items.mjs:734 @ 76845db4` — `hasSkill` takes a `name`, and the refusal reads "Requires {names}, which this Unit does not have." (`lang/en.json`, the ten `rama-*.yml`).
