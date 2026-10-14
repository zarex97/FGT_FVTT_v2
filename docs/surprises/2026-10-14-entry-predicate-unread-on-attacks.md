---
id: 2026-10-14-entry-predicate-unread-on-attacks
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Great Ram Nautilus gives Aim and the extra NP DmUp only in Waterside, as its entries' `predicate` says.
**Actual:** Out of the water Nemo still took Aim and the extra NP DmUp: the attack path's rider loop read no entry `predicate`; only the Skill path did.
**Cause:** `module/engine/attack.mjs:5012 @ a436802` — the rider loop tested the phase predicate and never `effectGatePasses`.
**Fix:** `module/engine/landing.mjs:197 @ 1f1b099` — `landEntry` gates every entry, with the caster as the board sees it.
