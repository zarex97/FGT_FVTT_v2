---
id: 2026-10-25-processes-stall-at-damage
found: live press
kind: write-before-store
status: open
reviewed: true
pattern: write-before-store
---
**Expected:** A Strike Air declared on an enemy Master, answered "nothing" and then past its Command Spell interrupt
(`interruptTimeout` 15 s), deals its damage and closes, as the same NP on Karna did a minute later.
**Actual:** Its Process stayed at `damage` with no pending prompt for over two minutes. Three Rhongomyniad Processes on
the same Master, declared before a Foundry restart, sat at `damage` too, every one with `pendingPrompt` null.
**Cause:** Not found. A Process at `damage` waits on the engine, not a person, and after a restart nothing drives a
stored one on (`write-before-store`). Whether the earlier stalled Processes on the same defender held the new one is
unproven.
**Fix:** Open. Found pressing #336; not in that audit's scope.
