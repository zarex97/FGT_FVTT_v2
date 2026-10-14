---
id: 2026-10-14-guards-are-the-whole-side
found: live press
kind: role-keyed-on-type
status: fixed
reviewed: true
pattern: role-keyed-on-type
---
**Expected:** Gate of Skye caught Medea's Master beside Medea: Ch. 32's cover is *"the Servant performs an Agility Check"*, her own Servant, Medea.
**Actual:** The log: `{"kind":"cover","event":"shoved","unitId":"7NcSIiyvKvGvZGi8","by":"eu9u2mNAlRnY45ga",...,"name":"Heracles"}`. Heracles, another Master's Servant on her side, shoved her.
**Cause:** `module/rules/relations.mjs:96 @ 4983091` — `guardsOf` returns every Servant of the Master's side; its own comment says "Ordinarily the Master's own Servants".
**Fix:** `module/rules/relations.mjs:115 @ cde0483` — ruled 2026-10-14: only the Servants contracted to that Master guard it. The faction scan was an engineering default from the first targeting code (`3326392`), never ruled; #181's own live press had Castor guard another Master's Master unnoticed.
