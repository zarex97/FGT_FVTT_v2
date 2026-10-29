---
id: 2026-10-29-first-sight-fired-twice
found: live press
kind: check-then-act-race
status: fixed
reviewed: true
pattern: check-then-act-race
---
**Expected:** `unitFirstSeen` fires once a pair: `seenUnitIds` records it.

**Actual:** Arjuna boarding the Carolus: "Ruler's True Name Discernment: Archer is Arjuna" twice, and two Arjuna pages in Notebook: Player1.

**Cause:** `module/engine/vision.mjs:51 @ 8db88035` — a move's sweep and a boarding's sweep read the board before either wrote `seenUnitIds`.

**Fix:** `module/engine/vision.mjs:53 @ 8db88035` — each pair is claimed in memory before any await.
