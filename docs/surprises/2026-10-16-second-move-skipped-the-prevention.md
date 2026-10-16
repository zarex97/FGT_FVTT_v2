---
id: 2026-10-16-second-move-skipped-the-prevention
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** Player1 rides Arturia one panel, places [Avalon] in her Master, and neither may Move after it (#230 AV.2.lock, reading 16).
**Actual:** the Master's own drag was refused ("FGT | prevented by itemRite"), but Arturia's second drag went through and carried her Master with her: both stood two panels on.
**Cause:** `module/engine/movement-hooks.mjs:183 @ b4464ed` — the move hook asks a prevention only inside `budget.affordable`, and skips that whole check for a Unit that has Moved this Turn (*"moves again for free"*). So any move-prevention that lands after a Unit's first Move — an Item Rite, a Stun from a reaction — never stopped the second.
**Fix:** `module/engine/movement-hooks.mjs:183 @ 9d0ab57` — `preventedBy(unit, "move")` is asked of every Move before the budget, and the refusal names the effect as the player reads it (`FGT.Movement.Prevented`). Arena test drags twice around the rite. The budget's own refusal printed the id too, "prevented by itemRite" on the Master's Avalon slot: `rules/budget.mjs#canConsume` names the effect now.
