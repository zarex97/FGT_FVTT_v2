---
id: 2026-11-08-gather-written-from-player-client
found: live press
kind: live-client-only
status: fixed
reviewed: false
---
**Expected:** Gather, pressed on the bar by its owner, adds to the pool and spends the Move, as Semiramis's always had.

**Actual:** pressed as Player1 on Avicebron, the bar printed *"User Player1 lacks permission to update Combat
[6rud4eIkx8EYw7Do]"* and wrote nothing. Its gain, once it ran, had no card: a log entry only.

**Cause:** `module/engine/gather.mjs:46 @ 06f295d` — `gather` wrote the owner's resource, the Turn Record and the
budget from whichever client pressed, and every earlier Gather had been driven as the GM. No socket operation existed.

**Fix:** `module/engine/gather.mjs:46 @ 5fddc29` relays a player's press to the GM (`OPERATIONS.gather`,
`module/net/operations.mjs`), as `placeMark` does, and posts `FGT.Gather.Line`.
