---
id: 2026-10-14-thrown-weapon-never-produced
found: test
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Rho Aias's floor answers a thrown Noble Phantasm (`poolFloorWhen: [attack:thrownWeapon]`).
**Actual:** No attack ever carried `thrownWeapon`: the option had a reader in `options.mjs` and the shield, and no producer.
**Cause:** `module/engine/attack.mjs:736 @ b959747` — `buildAttackSpec` copied `aim` and `pierce` off the damage block and not `thrownWeapon`.
**Fix:** `module/engine/attack.mjs:786 @ cc2a992` — a damage block may state it (`DAMAGE_BLOCK_KEYS`); no content NP is marked, pending the author's ruling.
