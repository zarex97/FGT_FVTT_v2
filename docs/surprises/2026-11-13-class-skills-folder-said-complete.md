---
id: 2026-11-13-class-skills-folder-said-complete
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** Grilling the Class Skills gap (Q10), I framed the guard as *"now that the `class-skills` folder is the list of Class Skills"*, and its option (a) failed any file marked `classSkill` outside the folder. The user ruled (a).
**Actual:** Fifteen ability files outside the folder already carry `kind: classSkill`, rightly: per-Servant variants such as `abilities/medea-item-construction.yml` and `abilities/normal-riding.yml`. Option (a) as worded would have failed legitimate content.
**Cause:** `packs/_source/abilities/normal-riding.yml @ 6315e1e`: I worded a grill option from the folder's name, without one grep for the kind outside it.
**Fix:** `test/unit/class-skill-kind.test.mjs @ 143a925`: the guard keeps what (a) was for, with the false half dropped. Every file in the folder carries the kind, and every ability its bearer's sheet prints after "Class Skill:" carries it wherever it lives. Said to the user.
