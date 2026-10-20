---
id: 2026-10-19-object-update-merged
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** `combat.update({"system.delays": {}})` empties the stored Delays at the Round's start.
**Actual:** after the new Round began, `system.delays` still read `{"faction-1": 1}`, the Delay just spent.
**Cause:** `module/documents/combat.mjs#rollTurnOrder @ a87324ca` — a Foundry update MERGES an object field: `{}` adds no keys and removes none. `delayFaction`'s `delete delays[id]` before writing had the same hole since it was written.
**Fix:** `module/documents/combat.mjs @ a87324ca` — each key is removed by `system.delays.-=<id>`, the form `concealment.mjs` and `fields.mjs` already use; pressed live 2026-10-19, `system.delays` read `{}` after the next Round's roll.
