---
id: 2026-10-15-wall-refusal-printed-id
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** a target refused by a field's wall names the field.
**Actual:** "Refused: No legal targets: Nemo is separated by emiya-unlimited-blade-works."
**Cause:** `module/rules/targeting/resolve.mjs:282 @ 7005d25` — dropped with `field.id`; the board projected no name for a field.
**Fix:** `module/engine/board.mjs#boundedFieldsOf @ 79877ec` projects the Region's name; resolve drops with `field.name ?? field.id`.
