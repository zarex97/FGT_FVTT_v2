---
id: 2026-10-17-essence-rows-object-object
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** Divine Banquet's whispered rows on its card name the change: *"Enki: Sword of the End:
Cooldown 9 → 0"*.
**Actual:** three rows reading `[object Object]` (#241, Player1, Master of Archer of Faction 1).
**Cause:** `module/engine/command-spells.mjs:290 @ uncommitted` — the card took a CardLine's `summary`
for a string; it is the attack card's effect row `{id, name, outcome}`, its sentence in `name`
(`engine/applier.mjs#cooldownLine` callers). Written from the line's name, not from one live line.
**Fix:** `module/engine/command-spells.mjs:290 @ uncommitted` — the row is `summary.name`.
