---
id: 2026-10-15-stars-skipped-the-twin
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: false
---
**Expected:** Castor's Stars of the Chief God puts the Castor and Pollux buffs on himself and on Pollux.
**Actual:** "2 effect(s) applied", both on Castor.
**Cause:** `module/engine/skill-use.mjs#targetsSelfOnly @ 960496f` — a self-anchored, self-relation spec short-cut to the caster before the resolver could add `alsoIncludes: partner`.
**Fix:** `module/engine/skill-use.mjs#targetsSelfOnly @ uncommitted` — false when `selection.alsoIncludes` is set; re-pressed, both twins carry both buffs.
