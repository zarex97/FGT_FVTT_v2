---
id: 2026-10-31-setfield-read-as-array
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** Mythos's `negatesAbilities` would read an ability's `categorizedAs` and `npTags` as lists, as the unit test's hand-built items did.
**Actual:** The first Rhongomyniad Mythos on Arjuna threw mid-Process, `TypeError: (sys.categorizedAs ?? []).includes is not a function`; the Damage Step never closed and the card lost its row.
**Cause:** `module/rules/snapshot.mjs:2490 @ fe7e8891` called `.includes` on `categorizedAs`, a `SetField` that Foundry hands back as a Set. The test built items with plain arrays.
**Fix:** `module/rules/snapshot.mjs#negatingEffectOf @ uncommitted` spreads both fields into arrays; `test/unit/gray-362.test.mjs` builds `categorizedAs` as a Set.
