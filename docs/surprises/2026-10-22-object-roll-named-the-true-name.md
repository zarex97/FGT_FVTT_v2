---
id: 2026-10-22-object-roll-named-the-true-name
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** the Spellbook's Luck Check line on the attack card names Gilles as the table knows him, "Caster",
as the destruction card beside it did.
**Actual:** the roll read *"Gilles's Luck Check fails: Prelati's Spellbook is destroyed."* on a public card while
his identity was concealed.
**Cause:** `module/engine/weak-point.mjs:198 @ 965a7cc5` — `resolveObjectAim` named him by `defenderDoc.name`, the
document's name, not `shownName`, the one reader of a Unit's public name.
**Fix:** `module/engine/weak-point.mjs:198 @ 965a7cc5` — the name is `shownName(defenderDoc, view)`.
