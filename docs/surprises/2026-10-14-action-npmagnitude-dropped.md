---
id: 2026-10-14-action-npmagnitude-dropped
found: test
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Enigma's Def Dwn (MAG) carries its authored NP magnitude, 40.
**Actual:** The instance carried `npMagnitude: null`: the scheduler built the intent's `magnitude` from the action level and the NP magnitude only from inside `effect`.
**Cause:** `module/engine/scheduler.mjs:1214 @ a436802` — `ApplyEffect` read `a.effect?.magnitude ?? a.magnitude` and no action-level `npMagnitude`.
**Fix:** `module/engine/scheduler.mjs:1221 @ 1f1b099` — `npMagnitude` read beside the effect as `magnitude` is; the field interior forwards it too.
