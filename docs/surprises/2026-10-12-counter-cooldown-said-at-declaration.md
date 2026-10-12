---
id: 2026-10-12-counter-cooldown-said-at-declaration
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** I told the user that the Fragarach Counter's c (NP cooldown −⅓◈) and d (+1 token) both run when the counter is declared, before its hit (#197, open question 2).
**Actual:** only d does. `resource` is in `CASTER_PHASES`, so it is paid at declaration. `cooldown` was taken out of that set in §46.4-X. It runs in the post-damage loop with a and b, so a Dodge, which skips the damage step, skips c as well.
**Cause:** `module/engine/skill-use.mjs:2689 @ 75ae578` — `CASTER_PHASES` lists `resource` and not `cooldown`. `module/engine/attack.mjs:4823 @ 75ae578` runs `cooldown` after the damage. I described both phases from the word "caster" without reading the set.
**Fix:** the question was restated to the user with c after the hit and only d at declaration. No code change.
