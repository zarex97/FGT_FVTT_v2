---
id: 2026-10-12-window-use-raised-no-ability-used
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Giant Monster of the Great River hears Monstrous Strength.
**Actual:** read while building the rulings: the Damage Step's billed use raised no `abilityUsed`; only a cast and an attack did.
**Cause:** `module/engine/attack.mjs:6412 @ 08ea4b1` — the window path billed, logged and announced, and fired nothing.
**Fix:** `module/engine/attack.mjs @ 23b5621` — `fireAbilityUsed` for each billed use; GAO ×3 at her first press.
