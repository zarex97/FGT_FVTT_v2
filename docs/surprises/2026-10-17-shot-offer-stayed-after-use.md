---
id: 2026-10-17-shot-offer-stayed-after-use
found: retraction
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** One shot per Attack (#243 reading 8): once Kiritsugu fires, the rung no longer offers it.
**Actual:** Read building reading 7: the attacking-reaction branch resolved the shot and returned the state unchanged,
so the same rung still listed *"Lethal Gunfire Suppression: Return Fire"*, pressable again.
**Cause:** `module/engine/attack.mjs:1499 @ a27e058f` withdrew offers only on the free and the non-attacking paths;
the shot's path produced an Attack and told the rung nothing.
**Fix:** `module/engine/attack.mjs:1514 @ 5101f86f` removes the shot's offer and saves the rung.
