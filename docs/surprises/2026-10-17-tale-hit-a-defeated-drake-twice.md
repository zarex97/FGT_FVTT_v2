---
id: 2026-10-17-tale-hit-a-defeated-drake-twice
found: live press
kind: check-then-act-race
status: fixed
reviewed: false
---
**Expected:** A Tale for Somebody's Sake on Drake and Van Gogh deals its damage to each once.
**Actual:** Player1's Tale: Drake's Process logged *"damage … total 699"*, Drake defeated, then *"damage … total 1070"* on the same Process before Van Gogh's resolved; the GM console carried two `Uncaught (in promise)` from `combat-process.mjs#advance` via `await-timeout.mjs#applyExpiry`.
**Cause:** `module/engine/attack.mjs#advanceAttack @ eebbb988`: a Process stores its state only when its run ends, so a run held at a question (prevention Luck Checks, a Command Spell window) leaves the card at its rung; a timeout re-armed by a message write answered from that stale read, and the per-rung claim did not hold it.
**Fix:** `module/engine/attack.mjs#advanceAttack @ 7755ebb4`: one driver per Process (`serialized`); a queued answer for a rung the Process has left, or a resume with nothing to drive, does nothing.
