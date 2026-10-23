---
id: 2026-10-22-reload-reset-outlive-stamp
found: live press
kind: write-before-store
status: fixed
reviewed: true
pattern: write-before-store
---
**Expected:** the five Elder Horrors that appeared as Gilles fell outlive him (`leavesWithSummoner: false`, #323
reading 9), whatever befalls him later.
**Actual:** after several reloads, the Gigantic Horror's defeat read "6 × Elder Horror, 8 × Horror leave the field
with Caster."
**Cause:** `module/content/authored-fields.mjs:142 @ d97795b9` — `leavesWithSummoner` is pack-owned, so the content
sync on every load wrote the pack's `true` over the stamp `summonAround` stores at the summons: a stored state with
no claim to survive the load, the shape §46.4-BN found for Bašmu's `boundToPlatformId`.
**Fix:** `module/content/authored-fields.mjs:150 @ 965a7cc5` — seeded, then the world's; test `content-sync.test.mjs`
"keeps a summon's stamp to outlive its summoner".
