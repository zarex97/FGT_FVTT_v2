---
id: 2026-10-29-ids-and-zeros-on-cards
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** a card names a source by its name and says only what a write made.

**Actual:** *"tamamo-yata-no-kagami (STR only)"* in Karl's breakdown; *"Overpower: no coin (foxSpouse)"*; and beside the
halved Higanbana cost, *"its Master loses 0 Health, the cost ×0.5"*.

**Cause:** `module/rules/bounded-fields.mjs:934 @ 60958e67`: a field's interior rules took the field's id as their source;
the new coin line read the suppression's raw source; a rank-less NP's own Rank cost of 0 was scaled and said.

**Fix:** `module/rules/bounded-fields.mjs:934 @ ebad7a6b` (the field's name), `module/engine/attack.mjs:1300` (the
effect's name), `module/engine/skill-use.mjs:1875` (no card for a cost of 0). Re-pressed: *"Amaterasu Area (STR
only)"*, *"no coin (Fox Spouse)"*. `test/unit/charm-sides.test.mjs:63` keyed on the old id source; it now reads
the field's name off the board.
