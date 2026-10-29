---
id: 2026-10-29-silent-tolls-and-entries
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** A platform's toll and an enemy's entry are outcomes a player must know.

**Actual:** The CPA's 30 and 10 left Karl's Master with no line; Arjuna entered the Carolus with no line; the extension asked "Extend the field?"; a card read "platform:carolus-patricius-auctoritas BA(MAG)".

**Cause:** `module/engine/fields.mjs:1860 @ 8db88035` — `runUpkeep` charged through `I.damage` and logged; the entry path wrote a log entry; the prompt reused the field's words; the label printed the source key.

**Fix:** `module/engine/fields.mjs:1865 @ 8db88035` — a card per toll (`FGT.Field.Upkeep`, `UpkeepActed`); `FGT.Platform.Entered`; `FGT.Platform.ExtendTitle`/`ExtendHint` name the platform; `rules/damage/pipeline.mjs` labels an owned platform by its name.
