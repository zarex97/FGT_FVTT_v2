---
id: 2026-10-14-copy-classified-passive
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Scáthach's two copies, granted from the GM's list, sit on her action bar as usable Skills, as their sources do.
**Actual:** The bar showed seven Skills and no copy. `classifyAbility` on each copy: `{"kind":"passive","clickable":false}`; `timing: null`, no phases, no targeting.
**Cause:** `module/engine/copy.mjs:156 @ 4983091` — a copy was written with `copiedFrom` and nothing about its use. Only the phases resolve by reference (`rules/copy.mjs#effectivePhases`); classification, the window and the targeting read the copy's own empty fields.
**Fix:** `module/engine/copy.mjs @ uncommitted` — `carriedUse` copies the source's use onto the copy, minus rank, cooldown, gates and passive `rules`; the phases still run from the source.
