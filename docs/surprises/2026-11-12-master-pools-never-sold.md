---
id: 2026-11-12-master-pools-never-sold
found: live press
kind: rule-word-read-one-way
status: fixed
reviewed: true
pattern: rule-word-read-one-way
---
**Expected:** A Master's Dossier offers "the Stats it has" (PR.master), so an enemy can learn his Health in time.
**Actual:** It offers MOV, Range, Attributes and Command Spells; a Master has Health, Agility and Luck pools but no Parameters, so END/AGI/LUC are never sold and his bars and pool lines stay closed all War.
**Cause:** `module/rules/intel.mjs:191 @ dd96b35` — `entriesOf` sells a pool only through its Parameter's Rank.
**Fix:** `module/rules/intel.mjs:191 @ a604763` — ruled 2026-11-12 (reading (b)): a Master's Health, Agility and Luck are each sold at 4 by their own Entry, the pool shown with no Rank.
