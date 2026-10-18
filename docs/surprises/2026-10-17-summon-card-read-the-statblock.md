---
id: 2026-10-17-summon-card-read-the-statblock
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** The lifesteal card says what the Jabberwock's Health did: 1000 → 746 on the hit, back to 936.
**Actual:** Its card said *"Health 1500 (no change)"*. The token's actor held 936; `game.actors.get("IZr1RpOwRBJvILac")` held 1500, the world statblock.
**Cause:** `module/engine/applier.mjs#statOf @ eebbb988` read `game.actors.get(unitId)`. A summon's token is unlinked (`documents/index.mjs#LINKED_TYPES`), and its synthetic actor shares the statblock's id, so that read answers the statblock. `engine/io.mjs#resolve` already knew this and wrote to the token. 310 `game.actors.get(` reads remain in `module/`; the test world's tokens share their actor with `game.actors`, so no test can see the difference.
**Fix:** `module/engine/board.mjs#unitActor @ uncommitted`, the token's actor first; `io.resolve`, `applier.mjs` and `turn-report.mjs` read through it. Re-pressed: *"Health 746 → 936"*. Open: the other 296 reads, and an unlinked token in the test world.
