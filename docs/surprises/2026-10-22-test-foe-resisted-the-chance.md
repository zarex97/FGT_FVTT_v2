---
id: 2026-10-22-test-foe-resisted-the-chance
found: test
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** the Gazing test: a Horror within 2 of a Gazing Gilles rolls 50 against a Medea, and Curse lands.
**Actual:** `expected [] to include 'curse'`. The handler was collected, the die was 50, and the hit landed.
**Cause:** `packs/_source/abilities/medea-item-construction.yml:30 @ d97795b9` — Medea's Item Construction
resists debuffs by 50, so the 50% came to 0 where it lands. I picked her as a plain foe without reading her
own resistances.
**Fix:** `test/unit/gilles-323.test.mjs @ 965a7cc5` — the foe is now `test-use-bench`, which has no
resistance of its own.
