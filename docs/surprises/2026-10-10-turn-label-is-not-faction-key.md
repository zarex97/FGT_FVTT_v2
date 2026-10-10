---
id: 2026-10-10-turn-label-is-not-faction-key
found: tooling
kind: display-name-compared-to-id
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** `nextTo("Faction 1")` advances Turns and stops on Faction 1's.
**Actual:** It went `["faction-1 t56","null t57","faction-1 t58"]`, passing Faction 1's Turn without stopping.
**Cause:** `scratchpad/pre.js:27 @ a238438` — the guard compares against the log's `turnStart.faction`, which holds the id `faction-1`. The combatant's display name is `Faction 1`, and the two never match.
**Fix:** `scratchpad/pre.js:27 @ a238438` — call it with the id, `nextTo("faction-1")`. It then stopped on `faction-1 t62`.
