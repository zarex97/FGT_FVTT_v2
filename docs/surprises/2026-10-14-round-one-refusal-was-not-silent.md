---
id: 2026-10-14-round-one-refusal-was-not-silent
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** §46.4-LJ, as I wrote it: *"Þurs's Attack button in Round 1 closed the dialog with no message"*, and I told the user every refusal but the budget's was silent.
**Actual:** Re-pressed as Player1 with the Round set to 1, the declaration posted a red toast: `FGT | No attacks are permitted during the first Round.` The press had looked for it after it faded.
**Cause:** `module/apps/actor-sheet/sheet.mjs:382 @ 4983091` — `declareAttack` catches the refusal and shows it; I claimed the silence from one screenshot, without reading the catch.
**Fix:** `module/engine/budget.mjs:55 @ uncommitted` — the real defect was the bar offering the slot; it now greys every Attack in Round 1, and the toast drops its `FGT | ` prefix.
