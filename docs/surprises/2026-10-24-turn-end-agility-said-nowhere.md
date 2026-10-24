---
id: 2026-10-24-turn-end-agility-said-nowhere
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Legend of Dracula's Night heal, *"restores 100 Health and 1 Agility"*, says both on the End of the
Turn card.
**Actual:** "Berserker regains 100 Health (Legend of Dracula: The Succession of Blood)." His Agility went 10 → 11
and no card said so. The Lancer's Night and Round-end heals were the same since #330.
**Cause:** `module/engine/scheduler-hooks.mjs:790 @ 4f6f04ab` ran a boundary's batch with no lines, and
`turn-report.mjs#turnEndCard` reads Health deltas and heals only.
**Fix:** `module/engine/scheduler-hooks.mjs#run @ uncommitted` reads Agility and Luck before the batch
(`applier.mjs#poolsBefore`) and returns their lines after it (`poolLinesAfter`), which the report prints.
