---
id: 2026-10-28-immunity-reason-prints-effect-id
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** A Burn refused by Burn Immune reads "Burn Immune" on the card.
**Actual:** The card read "Burn (burn Immune)".
**Cause:** `module/engine/effect-applier.mjs:582 @ a17cfa57` — `findImmunity` named a named immunity by `def.id`.
**Fix:** `module/engine/effect-applier.mjs:583 @ a17cfa57` — by `def.name`, the id only when there is none.
