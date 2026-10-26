---
id: 2026-10-25-aimed-at-master-not-involved
found: user
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Home Base E1, *"unless it fought here"*: a Master an Attack was aimed at is involved in that Combat
Phase, whoever ends up taking the hit.
**Actual:** The user: *"A master received the round end heal when he was involved in a combat process (he didn't
receive any damage, but even then he was involved)"*. Heracles's Master spent Teleport Servant on EMIYA's Hrunting in
Round 6, Heracles took it, and the Master regained 40 Health (Home Base) at the Round's end.
**Cause:** `module/engine/attack.mjs:3841 @ cc1d8e41` — `fireCombatPhaseEnd` built "involved" from each Process's
current `defenderId`. A `retarget` interrupt and a guard's step-in (`guardMasterTarget`) both replace that id and kept
no record of the Master they took the Attack from.
**Fix:** `module/engine/combat-process.mjs:814 @ d3452f94` — the `retarget` record keeps `fromId`;
`module/engine/attack.mjs:1458 @ d3452f94` — a guarded Attack stores `guardedMasterId` on its Process;
`module/engine/attack.mjs:3859 @ d3452f94` — both count as involved. Tests: `test/unit/guarded-master-involved.test.mjs`,
`test/unit/teleport-servant-retarget.test.mjs`. Not yet pressed live.
