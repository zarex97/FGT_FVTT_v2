---
id: 2026-10-12-window-use-raised-no-ability-used
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Giant Monster of the Great River hears Monstrous Strength.
**Actual:** read while building the rulings: the Damage Step's billed use raised no `abilityUsed`; only a cast and an attack did.
**Cause:** `module/engine/attack.mjs:6412 @ 50c5731` — the window path billed, logged and announced, and fired nothing.
**Fix:** `module/engine/attack.mjs @ 31aae3c` — `fireAbilityUsed` for each billed use; GAO ×3 at her first press.
