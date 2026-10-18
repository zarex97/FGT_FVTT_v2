---
id: 2026-10-17-alice-eater-extended-nothing
found: live press
kind: unknown-value-falls-to-default
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** Player1 pressed Alice Eater on the Jabberwock: Atk Up 50% and its stay extended by 3◈, 27 to 36.
**Actual:** The card read *"Alice Eater — 1 effect(s) applied"*; Atk Up landed and the stay stayed at 27.
**Cause:** `module/engine/skill-use.mjs#applyPhaseEffects @ eebbb988` read every entry of an applyEffects phase's `rules` as an effect; `DurationDelta` is a scheduler action, `entryOf` found no effect id, and the entry landed as nothing, in silence. The unit test drove `dispatch` directly, never the use path.
**Fix:** `module/engine/skill-use.mjs#applyPhaseEffects @ 7755ebb4` dispatches an entry that names a scheduler action, and refuses out loud one that is neither; `nursery-247-rulings.test.mjs` uses Alice Eater and reads 36.
