---
id: 2026-11-12-master-pools-never-sold
found: live press
kind: rule-word-read-one-way
status: open
reviewed: false
---
**Expected:** A Master's Dossier offers "the Stats it has" (PR.master), so an enemy can learn his Health in time.
**Actual:** It offers MOV, Range, Attributes and Command Spells; a Master has Health, Agility and Luck pools but no Parameters, so END/AGI/LUC are never sold and his bars and pool lines stay closed all War.
**Cause:** `module/rules/intel.mjs:191 @ dd96b35` — `entriesOf` sells a pool only through its Parameter's Rank.
**Fix:** Open: two readings put to the user (no Stat without a Rank, or a Master's pools sold by their own Entry).
