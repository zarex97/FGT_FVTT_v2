---
id: 2026-10-15-guarded-panel-read-occupied
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Castor refused a move onto the empty panel beside the enemy Master of Caster, whose Medea stood two from him, with a reason naming the Master's protection.
**Actual:** "Step 3 passes through a panel this Unit may not enter." and "The destination panel is occupied." The panel was empty.
**Cause:** `module/rules/movement.mjs#validatePath @ 960496f` — the step line is generic for every `canPassThrough` refusal, and the destination's `canStopOn` refusal always reads "occupied", so one refusal printed twice, once falsely. The leash had the same shape (D-leash-word).
**Fix:** `module/rules/movement.mjs#guardedMasterBeside @ 3cc6a34` — a guarded panel says "is beside an enemy Master, and its Servant guards that panel"; "occupied" is said only when the step itself was allowed.
