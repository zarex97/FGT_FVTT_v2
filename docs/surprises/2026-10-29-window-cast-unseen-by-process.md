---
id: 2026-10-29-window-cast-unseen-by-process
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** Kokutendō cast at the start of the Combat Phase she is attacked in Blocks that very Attack (reading 9).

**Actual:** Aphotic landed, yet the Process held `forcedReaction: null`, `forbiddenReactions: []`, and asked Player1 to
react, Evade offered.

**Cause:** `module/engine/attack.mjs:1668 @ bd007c46`: `declareProcesses` built each defender's rungs from the board the
declaration read before the defending window; what the window cast was not on it.

**Fix:** `module/engine/attack.mjs:1668 @ 9871bce7`: the rungs read a board taken after the window. Re-pressed:
`react → block`, unasked, Block −25%.
