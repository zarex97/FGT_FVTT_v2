---
id: 2026-10-18-migration-scene-link-refused-in-replace
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** schema 3 binds a War from before the move (`scene: null`) to its board in the runner's ordinary whole-document write, as every earlier migration wrote its documents.
**Actual:** the first live load backed the world up, migrated one War and stopped: "FGT | Migration failed: Error: The value provided to a ForeignDocumentField must be a BaseScene instance." `schemaVersion` stayed 2. The same id written by a plain `combat.update({scene})` was accepted.
**Cause:** `module/migration/runner.mjs:115 @ b6239686` — the runner writes `doc.update(next, {diff: false, recursive: false})`, and Foundry's server-side `Combat#_preUpdate` (`common/documents/combat.mjs:137`) refuses a scene link changed from `null` inside that replace. Assumed the replace accepted any field the schema validates.
**Fix:** `module/migration/runner.mjs:123 @ ddf335e4` — a Combat whose scene changes is linked by its own ordinary update first; the replace then carries the same id and passes. Live: schema 3, "Great Holy Grail War" bound to its scene, the world's values copied.
