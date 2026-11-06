---
id: 2026-10-25-bloodmark-took-medusa-clicks
found: user
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** EMIYA's player aims at Medusa on her panel and the Normal Attack is declared.
**Actual:** The user: *"there is a problem with aiming to medusa when she is on the same cell as a bloodmark"*.
The click picked the Bloodmark, a Structure only Masters may attack, and the attack was refused as illegal.
**Cause:** `module/engine/marks.mjs:250 @ 901bea6d` — `createMark` put the mark's token at `sort: 0` on Medusa's own
panel, so the newer token won every click. Platforms already sink beneath their passengers
(`engine/platforms.mjs#sinkBeneathPassengers`, `PLATFORM_SORT`); the marks and `skill-use.mjs#createStructure`, which
also places at its maker's feet, never asked that rule.
**Fix:** `module/engine/marks.mjs:263 @ 5ed93116` and `module/engine/skill-use.mjs:2816 @ 5ed93116` — both
create their token at the exported `PLATFORM_SORT`. The two marks on the live board were sunk by hand. Not yet pressed
live as Player1.
