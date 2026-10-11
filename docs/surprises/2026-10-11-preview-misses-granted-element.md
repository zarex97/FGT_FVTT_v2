---
id: 2026-10-11-preview-misses-granted-element
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** The damage preview and the resolution agree on Tenmōkaikai's Lightning half.
**Actual:** `previewContext` built Raikou's attack with no element, while the resolution added it.
**Cause:** `module/engine/attack.mjs @ f15a3d1` — the granted element was added only in `applyDamage`'s context, after the facts. The preview, the roll options and `attack:element:*` predicates never saw it.
**Fix:** `module/engine/attack.mjs @ uncommitted` — `attackFacts` adds it through `withGrantedElement`, so every reader of the facts sees one answer.
