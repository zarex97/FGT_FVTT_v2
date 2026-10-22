---
id: 2026-10-22-preview-counted-criteria-per-du
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** the targeting preview shows the damage the declaration will deal. The preview is a reader of the same
multiplier the resolution reads (the *Two readers, one rule* lesson).

**Actual:** pressed live as Player1. Test Count: Criteria was aimed at Arjuna and Anastasia together. The aiming HUD
and the review dialog showed "Archer 500 – 600" and "Archer 437 – 595", the ×5 that each DU alone would earn. The
card then read *"criteria met 1 of 6 (5)"*, and both Processes resolved at ×3.5.

**Cause:** `module/engine/attack.mjs:7468 @ 8eb07c60`. `previewContext` counted criteria over `[defender]`, the one
DU a row is drawn for. Task 6 ruled it that way and named the cost: *"a preview that differs from a multi-DU
resolution"*. The HUD (`apps/canvas/targeting-hud.mjs#row`) and the review (`apps/canvas/target-review.mjs`) hand
`damageFor` one id and never the set they are drawing.

**Fix:** `module/engine/attack.mjs:7487 @ 6aa2fc42`. `previewContext` takes the drawn set (`targets`), and the HUD and the review hand `damageFor` every id they draw. Test in `criteria.test.mjs`.
