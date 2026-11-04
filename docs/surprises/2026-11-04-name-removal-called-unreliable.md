---
id: 2026-11-04-name-removal-called-unreliable
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** In the Q55 grill I told the user that removing names from a Skill's text *"can't be done reliably by code across 460 files"*, and picked the option without text.
**Actual:** The user picked it anyway, and a word-bounded removal of the bearer's names and abilities left 11 names over the whole roster, all other Servants', and none once those were removed too.
**Cause:** `test/unit/public-ability-387.test.mjs @ cb28c87d` — I gave a verdict on the corpus without running one pass over it. The test that disproved it took minutes.
**Fix:** `module/rules/public-ability.mjs @ cb28c87d` — `scrubbedText`, with the roster walked by that test.
