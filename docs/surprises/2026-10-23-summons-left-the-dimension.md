---
id: 2026-10-23-summons-left-the-dimension
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** Gilles falls inside the Storm Border, the die barred (ruled 2026-10-23): his Elder Horrors appear
around him, inside it.
**Actual:** "5 of 5 Elder Horror appear around Caster." and all five stood on the ground Level, `k: 0`, outside the
dimension he fell in.
**Cause:** `module/engine/summoning.mjs:324 @ 965a7cc5` — `placeSummons` put a summon on its summoner's Level only when
it was bound to a platform; every other summon took the ground, as if no summoner could stand in a pocket dimension.
**Fix:** `module/engine/summoning.mjs @ 6f3ded34` — `summonLevelFor`: a summoner in a pocket dimension
(`environment.mjs#inPocketDimension`) summons onto its own Level; test "summons made inside a pocket dimension appear
inside it".
