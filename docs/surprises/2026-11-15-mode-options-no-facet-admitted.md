---
id: 2026-11-15-mode-options-no-facet-admitted
found: test
kind: unknown-value-falls-to-default
status: fixed
reviewed: false
---
**Expected:** Every predicate option the shipped corpus names is one a facet admits: `validate:content` holds every
predicate site to `isEmittableOption` (`tools/lib/content.mjs#predicateOptionsExist`).
**Actual:** The Godot port's content loader, given the same check at load, refused the exported corpus: Mad Enhancement's
drain floor (`activeRules[7].then[0].floorPredicate`) names `self:modeHeld:madEnhancement` and
`self:modeLocked:madEnhancement`, and `isEmittableOption` answers false for both, here too.
**Cause:** `module/rules/facets.mjs:222 @ a4240889` has no `modeHeld` or `modeLocked` facet, though
`module/rules/options.mjs:810-814` has emitted both since #190. The class skill states the floor as a template slot,
`floorPredicate: "@drainFloorWhen"` (`packs/_source/class-skills/mad-enhancement.yml:218`), and the build skips a template's
`@` slots, so it never read the resolved copies the Servants carry. The runtime was right (the options are emitted and
tested); the facet table, the author's vocabulary, could not name them.
**Fix:** `module/rules/facets.mjs @ uncommitted`: `modeHeld` and `modeLocked` are facets, with their lang labels;
`docs/11-predicates.md` says why. The Godot loader keeps reading the resolved copies.
