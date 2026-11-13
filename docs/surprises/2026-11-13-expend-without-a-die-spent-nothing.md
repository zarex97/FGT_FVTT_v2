---
id: 2026-11-13-expend-without-a-die-spent-nothing
found: test
kind: unknown-value-falls-to-default
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** `Expend` spends the abilities it names, as its key says.
**Actual:** Authored with no `roll` (Lancelot's Arondight ends his page outright) it returned `[]`: nothing spent, nothing said.
**Cause:** `module/engine/scheduler.mjs:1765 @ 6315e1e`: the executor read only the die path; a missing `roll` fell through to the empty answer.
**Fix:** `module/engine/scheduler.mjs:1770 @ 0d3920a`: no `roll` spends at once, with its line.
