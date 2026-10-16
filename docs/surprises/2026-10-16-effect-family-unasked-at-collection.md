---
id: 2026-10-16-effect-family-unasked-at-collection
found: test
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Arturia's Charisma, `not:self:effectFamily:atkUpCharisma`, goes off while she holds Knight of Utopia's Atk Up (Charisma) (#230 reading 23).
**Actual:** the ally beside her kept the +20: "expected [ { key: 'flatDamage', … } ] to have a length of +0 but got 1".
**Cause:** `module/rules/snapshot.mjs:1818 @ b4464ed` — `contributionsOf` built the bearer's own option set with its `effects` and no `effectFamilies`, so every `self:effectFamily:` clause tested at collection was false; the board projection carried the families, the collection did not.
**Fix:** `module/rules/snapshot.mjs:1818 @ uncommitted` — the collection's option set carries the families of the live, unsuppressed effects (`familiesPresent`).
