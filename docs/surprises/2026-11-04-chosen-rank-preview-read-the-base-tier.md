---
id: 2026-11-04-chosen-rank-preview-read-the-base-tier
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Choosing Rank A++ for Gate of Babylon changes everything that reads the use.
**Actual:** The card, the cost and the clock read A++. The targeting tooltip under the cursor still read Rank E: *"AlterEgo 202 – 283"*, for an attack that dealt 787.
**Cause:** `module/apps/actor-sheet/sheet.mjs:443 @ cf8afdb0` — the Rank was asked first and sent on the placement, and `pickPlacement` was still handed the plain Item, whose `damage` is the base tier's.
**Fix:** `module/apps/actor-sheet/sheet.mjs @ 10b3675f` — aimed through `tierView`, so the preview reads the Rank chosen; pressed again at A++: *"540 – 720"*.
