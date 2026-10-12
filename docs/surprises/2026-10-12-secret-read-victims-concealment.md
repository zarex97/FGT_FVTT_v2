---
id: 2026-10-12-secret-read-victims-concealment
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** Serenity concealed, her Turn ends, Zabaniya P2's aura inflicts Secret Poison on every Unit within 2.
**Actual:** five Units took Poison, every instance `visibility: public`, `attributionHidden: false`, `sourceUnitId` hers. The Poison was open while she was concealed.
**Cause:** `module/engine/scheduler.mjs:1252 @ 50a76fe` — `concealedNow(u)`; for a `target: nearby` action `dispatch` hands each recipient in as `u` and the bearer as `c.bearer`, so it asked whether the victim was concealed.
**Fix:** `module/engine/scheduler.mjs:1255 @ uncommitted` — `concealedNow(c.bearer ?? u)`, the inflicter's concealment.
