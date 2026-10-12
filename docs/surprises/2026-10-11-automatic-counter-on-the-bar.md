---
id: 2026-10-11-automatic-counter-on-the-bar
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: false
---
**Expected:** the Fragarach Counter is declared only by the engine. Its own file opens with "NOT A BUTTON".
**Actual:** it sat on Mannanán's action bar as an Attack Skill slot: "Fragarach Counter — Ready from Round 2", later "Prevented" under NP Seal. With no cooldown and no window, nothing marked it as engine-only.
**Cause:** `module/rules/ability-use.mjs:245 @ 75ae578` — `classifyUse` makes any ability with a damage phase a clickable attack. No field said "declared by the engine, never by a player".
**Fix:** `module/rules/windows.mjs @ 57c23ae` adds the `automatic` window. `classifyUse` returns it unclickable, and `mannanan-fragarach-counter.yml` names it.
