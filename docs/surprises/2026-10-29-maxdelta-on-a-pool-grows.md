---
id: 2026-10-29-maxdelta-on-a-pool-grows
found: retraction
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** `MaxDelta` on `resources.mantra` raises the Mantra maximum to 6 while `amaterasu` is held, as Karl's
Ceremonial Reformation raises Max Health.

**Actual:** reading the preparation before building on it: `restoreModifiable` puts back only the paths in
`MODIFIABLE_PATHS` (health, agility, luck and the stats), so a delta on any other `.max` is added again on every
preparation, the Detect defect's shape.

**Cause:** `module/rules/derived.mjs:212 @ 60958e67`: the list of maximums the preparation resets holds no resource pool,
and nothing refused a `MaxDelta` outside it.

**Fix:** `tools/lib/content.mjs:1598 @ uncommitted`: a `MaxDelta` whose `.max` the preparation does not reset is
refused. Yata no Kagami stores the maximum at 6 and its field's `onEnd` puts it back to 3.
