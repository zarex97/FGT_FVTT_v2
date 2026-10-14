---
id: 2026-10-14-reaction-ignored-group-lock
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** With the Monstrous Snake copy cooling, the Eye of the Mind copy is locked ("Cannot be used if Wisdom of Dún Scáith (Skill 2) … is on Cooldown"), as the bar said.
**Actual:** Karna's Brahmastra card offered "Eye of the Mind (False) (copied)" as a reaction.
**Cause:** `module/rules/reactions.mjs:72 @ 4983091` — a reaction checks only the requirement kinds in `SELF_REQUIREMENTS`, and `abilityOffCooldown` was not one; the bar's gate reads every requirement.
**Fix:** `module/rules/reactions.mjs:72 @ cde0483` — `abilityOffCooldown` joins the list, checked with the ability itself so it can leave itself out.
