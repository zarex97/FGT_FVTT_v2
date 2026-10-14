---
id: 2026-10-14-test-world-users-never-active
found: test
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** in the test world, a question routed by `askOwner` reaches a window, even if nothing then answers it.
**Actual:** every routed question resolved `null` before reaching any window. `FGTSocket.ask` threw `USER_OFFLINE` and `askOwner` swallowed it.
**Cause:** `test/helpers/world.mjs:674 @ ebd3f2a` — the world's one user was `{id, isGM, isSelf}`, with no `active`, and `module/net/socket.mjs:131` refuses an inactive user. The user was built from what one reader needed, not from a live user's shape.
**Fix:** `test/helpers/world.mjs @ 0ea6808` — users are `{id, name, isGM, isSelf, active, hasPermission, getFlag}`, a GM and a Player1, and every question is logged with who saw it.
