---
id: 2026-10-19-alignment-read-as-moral
found: test
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** the Good-aligned Civilian rule ("Good-aligned Servants will not use an AoE Noble Phantasm with a Civilian in range") reads the Alignment a Servant carries, as its test said it did.
**Actual:** it read `caster.alignment?.moral`. A Servant's Alignment is `{order, morality}` (`data/actor/servant.mjs:72`, projected whole at `rules/snapshot.mjs:406`), so no live Servant could ever trip it. Its test built `alignment: { moral: "good" }` by hand and passed on the shape it invented.
**Cause:** `module/rules/targeting/resolve.mjs:391 @ 27ef5aa0` — the reader and its test agreed on a field name the DataModel never had. Found while reading for Yan Qing's alignment predicate (#253).
**Fix:** `module/rules/targeting/resolve.mjs:391 @ uncommitted` reads `morality`; `test/unit/targeting.test.mjs:708 @ uncommitted` builds the live `{order, morality}` shape. No content authors `forbidCivilians` yet, so nothing played differently.
