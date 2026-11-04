---
id: 2026-11-04-grill-readings-claimed-unmatched-names
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** Gilgamesh's readings said each name on Enuma Elish's exempt list is checked against a sheet, *"so a misspelling fails the build"* (reading 15), that *"Reality Marble in its name"* means an ability whose name holds those words (reading 24), and that ending an area returns the Units inside it (reading 18).
**Actual:** Re-read for the user's request for quotations. Demeter (Erinyes), BB Dubai and Azumi no Isora have no sheet, so that check could never pass. No ability name in the corpus holds "Reality Marble": only Bradamante's tag does, *"[Anti-Unit/Reality Marble]"*. `endField` moves no Unit. Reading 20 also added areas to a clause that says *"from all Units"*.
**Cause:** `docs/superpowers/specs/2026-11-02-gilgamesh-clauses.md:124 @ cf8afdb0` — the readings were written from Gilgamesh's sheet and kin alone. The names were never run against the corpus, and `module/engine/fields.mjs:807 @ cf8afdb0` was not read.
**Fix:** `docs/superpowers/specs/2026-11-02-gilgamesh-clauses.md @ uncommitted` — readings 15, 18, 20 and 24 corrected and ruled; the name map is on the row (`gilgamesh-enuma-elish.yml`), and `test/unit/gilgamesh-374.test.mjs` holds each mapped sheet to the disk.
