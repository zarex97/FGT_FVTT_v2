---
id: 2026-10-14-owner-and-gm-both-ran-the-move
found: live press
kind: live-client-only
status: fixed
reviewed: true
pattern: live-client-only
---
**Expected:** Player1 moving Karna one panel spends the move, records it and carries his Master once, quietly.
**Actual:** The move landed and the Master came along, but Player1's screen showed "User Player1 lacks permission to update Combat [zIDd9M9R45SmCdzr]" and the GM's console "Displacement of Master to [object Object] did not complete".
**Cause:** `module/engine/movement-hooks.mjs:325 @ 7333e08` — `moveToken` fires on every client, and the gate `!activeGM.isSelf && !actor.isOwner` let the owner run the bookkeeping beside the GM: the player's budget write was refused and both clients carried the Master.
**Fix:** `module/engine/movement-hooks.mjs:325 @ 95b91ea` — the active GM runs it, the owner only when no GM is connected.
