---
id: 2026-10-11-rider-hit-hides-resistance
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Usui's hit inflicts Disable when its 50% rider roll succeeds.
**Actual:** The card read "disable on Mannanán mac Lir rider- 1d100 → 39 against 50%: hit". No Disable landed, and nothing said why.
**Cause:** `module/engine/attack.mjs:2348 @ f15a3d1` — the rider's verdict was filed before the effect flow ran. The flow rolled the same 39 against 30% after his resistance and returned `resisted`, which nothing recorded.
**Fix:** `module/engine/applier.mjs @ b9884b9` — a resisted effect logs `effectResisted`. `fireDamageDealt` files the verdict after the batch: "resisted (rolled 39 vs 30%)".
