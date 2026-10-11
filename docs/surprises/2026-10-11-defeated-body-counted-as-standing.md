---
id: 2026-10-11-defeated-body-counted-as-standing
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** With Watanabe, Sakata and Urabe defeated, Usui reads `lastOfSummonGroup: true`, and its defeat ends Tenmōkaikai.
**Actual:** Usui read `last=false` while the other three read `hp0 defeated=true`.
**Cause:** `module/rules/snapshot.mjs:2171 @ f15a3d1` — the count took every summon on the board. A defeated Unit's body now stays until `clearBody` a Turn later (§46.4-CN), so the dead copies still counted. The flag was written when a defeat removed the token.
**Fix:** `module/rules/snapshot.mjs:2171 @ b9884b9` — a defeated summon is left out of the count.
