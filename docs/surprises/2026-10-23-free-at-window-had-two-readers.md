---
id: 2026-10-23-free-at-window-had-two-readers
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** `freeAtWindow` built when `useSkill` stopped billing a window use of Kazıklı Bey's Active 2 (#330
ruling 9).
**Actual:** the press gate asks the budget before `useSkill` spends it, and computed `free` from `freeAction` alone:
a window cast of Active 2 on a spent Turn would be refused before the free use path was reached. Found only because
the Pale Rider scan named both lines.
**Cause:** `module/engine/press-gate.mjs:112 @ 630495df` — the gate's own `free`, a second reader of "is this use
free" that the use path's change did not reach.
**Fix:** `module/engine/press-gate.mjs:112 @ 2f18de06` reads `freeAtWindow` with `atWindow`, as `useSkill` does.
