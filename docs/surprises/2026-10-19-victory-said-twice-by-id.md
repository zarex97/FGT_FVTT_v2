---
id: 2026-10-19-victory-said-twice-by-id
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** a War won by elimination posts one card naming the winning faction.
**Actual:** War 157's chat log read *"Every rival has fallen. Victory goes to faction-1."*, and the same card again 13 minutes later at the next Round's end.
**Cause:** `module/engine/scheduler-hooks.mjs:779 @ 856a58ff` — `advanceGrail` asked `checkVictory` at every Round's end and posted whenever it answered, with nothing remembering a win; it formatted `victory.faction`, the faction's id, where the HUD's `factionLabel` reads the name.
**Fix:** `module/engine/scheduler-hooks.mjs:781 @ a87324ca` — a `victory` flag on the War posts it once, and the faction's name comes from `factions(combat)`. Pressed live 2026-10-19: two Round ends of War 157 posted one card, *"Every rival has fallen. Victory goes to Red."*
