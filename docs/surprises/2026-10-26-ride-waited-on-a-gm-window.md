---
id: 2026-10-26-ride-waited-on-a-gm-window
found: retraction
kind: drive-kit
status: fixed
reviewed: false
---
**Expected:** a Riding Attack through Cú opens a Combat Process card at once.
**Actual:** two rides moved Siegfried, stamped `usedRidingAttack` and `attacked`, and left no card, so I read them as
spent on nobody. Each was waiting on Cú's Disengage offer, *"Start of the Combat Phase you are attacked in"*, open
unanswered on the GM's page; three were stacked there. Answered, all three rides hit Cú (74, 141, 81).
**Cause:** `module/engine/riding.mjs:142 @ 2cfdf9b3` — the ride's fan-out declares through `resolveAttack`, which
asks the defenders' `defendingPhaseStart` windows before any Process card exists; the drive watched the cards only.
**Fix:** `docs/superpowers/specs/2026-10-26-siegfried-clauses.md @ 86d636c5` — no engine change. The drive answers
every open GM window before reading a press's result.
