---
id: 2026-10-26-validator-missed-dropped-entry-key
found: test
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** `npm run validate:content` names a Silent Drop: an Authored Key the model would not keep.
**Actual:** Balmung's Effect Entry authored `countedOnly`, a key `ENTRY_KEYS` did not list. `entryOf` dropped it, NP
Regen (Balmung) landed at magnitude 0 with no Anti-Dragon effect, and the validator printed *"0 error(s), 0 Silent
Drop(s)"*. My own landing test caught it.
**Cause:** `tools/lib/content.mjs:1941 @ dc6ed266` — the `phaseEffects` loop checks an entry's effect id, its closed
`select` values and its `params`, never its keys against `ENTRY_KEYS`; `test/unit/landing-one-door.test.mjs` sweeps
for them, the build does not.
**Fix:** `tools/lib/content.mjs:1010 @ 25591374` — the build refuses an entry key outside `ENTRY_KEYS`,
naming the path, at every nesting `effectEntriesIn` walks (#342).
