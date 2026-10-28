---
id: 2026-10-28-card-note-read-not-applied
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Pinaka's die that held would read "Shiva Dhanush: 1d12 → 10. It holds (breaks on 5)." on the card.
**Actual:** "Shiva Dhanush: 1d12 → 10. It holds (breaks on 5).: not applied", and the breaking die the same.
**Cause:** `module/engine/applier.mjs:457 @ 02fe93eb` — a handler's stated line (`cardLine`) was filed with outcome `noop`, and `module/rules/card-visibility.mjs:279 @ 02fe93eb` prints every `noop` as "not applied".
**Fix:** `module/engine/applier.mjs:460 @ 76845db4` — the line's outcome is `note`, and `effectLine` prints a note as its own words (`card-visibility.mjs:276`). Galvanism's "nothing to cut" line had the same suffix.
