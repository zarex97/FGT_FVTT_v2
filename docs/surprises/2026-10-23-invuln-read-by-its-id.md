---
id: 2026-10-23-invuln-read-by-its-id
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Gyakkou's Invuln (Gyakkou), *"separate from normal Invuln"*, works as an Invuln: no damage, half
against an NP, no Block, no Overpower, and spent first (#328 ruling 10).
**Actual:** four readers asked for the effect id `invuln` itself: the damage pipeline, the ladder's collapse, the
Overpower check and the charge spender. A second Invuln of its own id would have been none of them.
**Cause:** `module/rules/damage/pipeline.mjs:1227 @ d24c003e`, `module/engine/combat-process.mjs:626`,
`module/rules/relationships.mjs:75` and `module/engine/attack.mjs:5943`: `effects.includes("invuln")` and
`defId === "invuln"`.
**Fix:** `module/rules/effects/families.mjs#holdsFamily` and `#spentFirstOf @ 7f02a2c2`: Invuln is a family,
`invuln.yml` and `invuln-gyakkou.yml` its members; every reader asks the family, and the spender takes the one
marked `spentFirst`. `olga-328.test.mjs` "Invuln (Gyakkou) is an Invuln".
