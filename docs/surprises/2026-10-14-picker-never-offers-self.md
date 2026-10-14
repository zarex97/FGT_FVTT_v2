---
id: 2026-10-14-picker-never-offers-self
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Player1 casting Ár, `selection: { relations: [ally, self] }`, can pick Scáthach herself (#204 reading 2).
**Actual:** Her own panel was not highlighted, and hovering or clicking it chose "Nemo" — "1 target(s) · Nemo · ✓ Legal".
**Cause:** `module/rules/targeting/resolve.mjs:1115 @ 4983091` — the picker's candidates dropped the caster unless `includeSelf` was stated, while the resolver's own `resolveIncludeSelf` reads `relations` including `ally` or `self` as yes.
**Fix:** `module/rules/targeting/resolve.mjs:1115 @ cde0483` — the candidates ask `resolveIncludeSelf`, the resolver's reading.
