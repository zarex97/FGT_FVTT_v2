---
id: 2026-11-12-roll-record-dropped-ability-ref
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** A Faction that learned an ability reads its dice by name (CL.name).
**Actual:** An ability's chance die read "Rider's ■■■" for good: only Instinct's wrapper carried `abilityRef`.
**Cause:** `module/rules/roll-log.mjs:36 @ 0d8224a` — `record` copies a closed set of fields and dropped any `abilityRef` passed to it.
**Fix:** `module/rules/roll-log.mjs:36 @ 0d8224a`, `module/engine/attack.mjs:3725 @ 0d8224a` — the record keeps `abilityRef`; a rider's die carries its handler's `abilityId`.
