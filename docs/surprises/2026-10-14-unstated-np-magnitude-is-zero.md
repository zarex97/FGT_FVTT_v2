---
id: 2026-10-14-unstated-np-magnitude-is-zero
found: test
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** A Def Dwn with no `npMagnitude` raises damage from a Noble Phantasm by its full magnitude. Primordial Rune's enemy row 2 says so in its comment, and Appendix A gives Def Dwn no reduced NP figure. The pipeline's own contract says `npValue` *"defaults to `value`"*.
**Actual:** A probe of `resolveRuleValues` on Def Dwn at magnitude 25 with no NP magnitude gives `{"value":25,"npValue":0}`. Against an NP it adds 0%.
**Cause:** `module/rules/snapshot.mjs:1495 @ da0dc77` — `instanceValue` turns an absent `@npMagnitude` into `0`, so `pipeline.mjs:1447`'s fallback to `value`, keyed on `undefined`, never runs.
**Fix:** `module/rules/snapshot.mjs:1525 @ cde0483` — an instance with no NP figure leaves `npValue` undefined, so readers fall back to `value` (#204 reading 5); live, Karna's Def Dwn read `npValue undefined`.
