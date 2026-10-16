---
id: 2026-10-16-survival-restore-applied-before-damage
found: test
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** Avalon's floor in a Master at 120/350, hit for far more, leaves it at 1 Health and standing (#230 reading 18).
**Actual:** "expected 70 to be 1": the writes were Health 350, then 0, then the Damage Step's heal to 70. The floor's restore landed first and the damage emptied the bar after it.
**Cause:** `module/engine/attack.mjs:4332 @ b4464ed` — a survival floor in `resolveDefeatOf` returned `statDelta(-remaining + restored)` into the same batch as the `damage` intent, and `statDelta` orders before `damage` (`engine/intents.mjs` ORDER 2 vs 4). CS: Survive Kill used that shape since it was written and no test played it.
**Fix:** `module/engine/attack.mjs:4975 @ 9d0ab57` — `survivalFloor` caps the DAMAGE before the batch, as the recorded-attack floor already does, for Survive Kill and `SurviveLethal` both.
