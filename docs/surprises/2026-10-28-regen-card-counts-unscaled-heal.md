---
id: 2026-10-28-regen-card-counts-unscaled-heal
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Under Heal Up 50, a Regen tick of 5% writes 75 and its card says 75.
**Actual:** Health 500 → 550 at the end of her Turn, a Curse tick of 25 and a heal of 75, while the card read "Archer regains 50 Health (Regen)".
**Cause:** `module/engine/scheduler-hooks.mjs:194 @ a17cfa57` — the turn and Round reports counted the boundary's heal intents before `applyIntents` scaled them (`applier.mjs#resolveHealing`), so the card and the write had two readers of one heal.
**Fix:** `module/engine/scheduler-hooks.mjs:194 @ a17cfa57` — the boundary batches are scaled first with the exported, idempotent `resolveHealing`; live, "Archer regains 75 Health (Regen)".
