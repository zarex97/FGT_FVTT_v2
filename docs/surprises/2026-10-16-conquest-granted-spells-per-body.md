---
id: 2026-10-16-conquest-granted-spells-per-body
found: live press
kind: role-keyed-on-type
status: fixed
reviewed: true
pattern: role-keyed-on-type
---
**Expected:** Medea's Rain of Light defeats the Master of Assassin; her Conquest claims the hundred as one Servant and gains 3 Command Spells for it (#226 reading 17).
**Actual:** all six bodies were claimed, and `commandSpellsPerServant` held 3 for each: 18 Command Spells.
**Cause:** `module/rules/contract.mjs:200 @ 8502280` — `conquestContract` granted per actor contracted to the dead Master; a legion is six actors and one Servant.
**Fix:** `module/rules/contract.mjs:200 @ 11e972b` — one grant per legion, namespaced to its key; `rules/command-spells.mjs` and `io.spendCommandSpells` read a body's pool by that key.
