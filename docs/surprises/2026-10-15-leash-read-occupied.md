---
id: 2026-10-15-leash-read-occupied
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Castor dragged three panels from Pollux is refused with a reason naming the leash.
**Actual:** "The destination panel is occupied." over an empty panel.
**Cause:** `module/rules/movement.mjs#validatePath @ 960496f` — `canStopOn` refused the panel for the leash, and the reason line read every `canStopOn` refusal as an occupant.
**Fix:** `module/rules/movement.mjs#leashBreakAt @ 3cc6a34` — one reader for `canStopOn` and the reason: "Castor must stay within 2 panels of Pollux."
