---
id: 2026-10-19-lost-run-stalled-at-injury
found: live press
kind: write-before-store
status: fixed
reviewed: false
---
**Expected:** with 12f979b2 writing the held rung before holding it, a GM reload in the window after the damage leaves a card past the damage, and the attack finishes when the GM is back (the reading I gave #250: "likely fixed, never pressed").
**Actual:** the damage landed once (Medea 1973 → 1811), and the card then held `injury` for good: a minute after the reload the ladder still read `declare, missCheck, react, damage`, no Injury Roll, no facing, no Counter.
**Cause:** `module/engine/attack.mjs:2098 @ 856a58ff` — a Process is driven only by the run that answered its last rung, in that client's memory; nothing on load drives a stored state that waits on nobody. The replay #250 reported had become a stall.
**Fix:** `module/engine/attack.mjs:2105 @ a87324ca` — `resumeStalledProcesses`, on the GM's ready and every `canvasReady`, drives on each Process on that scene that waits on nobody; `module/engine/attack.mjs:2159 @ a87324ca` — the state is stored right after a rung that writes to a Unit, so the resume never replays one.
