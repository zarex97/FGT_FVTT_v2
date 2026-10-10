---
id: 2026-10-10-faction-budget-swallowed-the-press
found: tooling
kind: staging-reset-misses-a-gate
status: fixed
reviewed: false
---
**Expected:** Resetting Nemo's Turn record and Quickfire's cooldown readies a second Quickfire in the same Turn.
**Actual:** The press silently did nothing and left the Targeting layer active. The tracker read "Servant attacks 2/2", the faction's budget, which `resetTurn` does not touch. Pressing Escape to clear it opened Foundry's main menu.
**Cause:** `scratchpad/pre.js resetTurn @ d162f50` resets only the Unit's `markTurn`; the faction-level attack budget is a second gate.
**Fix:** Advanced to the faction's next Turn instead, then `canvas.tokens.activate()` before selecting. Also: a world left after an Erase test held Nemo `contract: "free"`, so ZON never applied until `system.contract` and `system.masterId` were restored.
