---
id: 2026-10-11-counter-offered-per-instance
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** At most one Counter per target against Dohatsu Tenshou, after the whole Noble Phantasm (reading 17).
**Actual:** Every instance's ladder ran its own counter rung: "counter → declined" on each of EMIYA's cards.
**Cause:** `module/engine/attack.mjs:3400 @ f15a3d1` — `counterAvailable` judged each process alone. A multi-instance declaration fans out one process per instance per target, so the counter rung multiplied with it.
**Fix:** `module/engine/attack.mjs @ uncommitted` — processes carry `instanceIndex` and `instanceCount`, and only the last instance per target offers the Counter.
