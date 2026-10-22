---
id: 2026-10-22-sheet-showed-landed-magnitude
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** once `magnitudeOf` computed a falling magnitude (#296), every place that shows an Effect's
magnitude shows the value it stands at now.

**Actual:** pressed live as Player1, the Turn-end card read *"Ruler: Crit DmUp (Nightowl, live) falls to 75"*.
Test Jeanne's Effects tab still showed `100` for the same instance.

**Cause:** `module/apps/actor-sheet/present.mjs#groupEffects @ 9b890b43`. The sheet row spread the instance
projection, whose `magnitude` is the landed value. Only the contributions path (`snapshot.mjs#instanceMagnitude`)
was routed through `magnitudeOf`. The sheet is a reader too.

**Fix:** `module/apps/actor-sheet/present.mjs#groupEffects @ fc6f5064`. The row's `magnitude` is
`magnitudeOf(instance, def, now)`, and `context.mjs#effectsContext` passes the tick and the War's ◈.
