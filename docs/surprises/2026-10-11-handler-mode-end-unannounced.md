---
id: 2026-10-11-handler-mode-end-unannounced
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** When Tenmōkaikai is forced off at a Turn's end, a card says so and why.
**Actual:** Tick 24 ended with Tenmōkaikai off, four copies gone and her Master untouched at 1. Chat said nothing.
**Cause:** `module/engine/turn-report.mjs:20 @ f15a3d1` — the Turn-end card reported Health changes only. A `SetMode` off from a Turn-end handler was written and never said. Mad Enhancement's own message comes from `reconcileForcedModes`, a different path.
**Fix:** `module/engine/turn-report.mjs @ b9884b9` — the card adds "{ability} ends on {who} ({source})." for each mode a handler switched off, and `scheduler-hooks.mjs` posts it for the deferred handlers too (her defeat).
