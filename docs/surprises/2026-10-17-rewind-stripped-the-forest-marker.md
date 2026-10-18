---
id: 2026-10-17-rewind-stripped-the-forest-marker
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: false
---
**Expected:** Ruled (#247 reading 6): a rewind leaves the forest's Tokens and what they took.
**Actual:** After the rewind Arturia held 1 Token and no `namelessForest` marker. The escape button and the death die both hang from the marker, so the Token was now read by nothing.
**Cause:** `module/engine/state-history.mjs#rewindIntents @ eebbb988` kept the Tokens out of the restore (`REWIND_EXCLUDED_RESOURCES`) and replaced the effects wholesale with the recorded ones, from before the forest landed.
**Fix:** `module/engine/state-history.mjs @ uncommitted`: `REWIND_EXCLUDED_EFFECTS` keeps the marker and the Resistance as they stand; `nursery-247-rulings.test.mjs` rewinds past a landing.
