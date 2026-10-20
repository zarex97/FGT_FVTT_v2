---
id: 2026-10-20-held-removal-said-nothing
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Medea's Rule Breaker on Anastasia under BuffRemoval ResUp 100 (Clause `FS.2`): the card says her buffs held.
**Actual:** card xeEWNPBSY20lAeFO listed only *"Rule Breaker"* (the Contract cut); every buff stayed on her and nothing on the card said why, or that a removal had been tried.
**Cause:** `module/engine/attack.mjs:6288 @ 50eae993` — the Noble Phantasm's removal phase applied its intents through `applyBatch` and returned nothing to the card; `removalPlan`'s `resisted` list had no reader.
**Fix:** `module/engine/attack.mjs#removalIntents @ uncommitted` — a line per effect removed and per effect held (*"Atk Up: resisted, rolled N vs 0%"*). `anastasia-258-rulings.test.mjs`.
