---
id: 2026-10-31-shiisaa-counter-gain-unsaid
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** DB.p1: each non-Attack Skill in the Form gains a Shiisaa Counter, said with the use.
**Actual:** Shiisaa 0 → 1 → 2 on Sacred Guardian Beast and Yanamun Reversal; their cards say '4 effect(s) applied' and nothing of the Counter; the payout's removal of all three is unsaid too.
**Cause:** `module/engine/skill-use.mjs:2672 @ 7b1e3c86` — the abilityUsed handler's ResourceDelta lands with no pool line on the use card (not traced further).
**Fix:** `module/engine/applier.mjs` `resourcesBeforeBatch`, `resourceLines` @ a93cc681 — a handler batch's pools are lines; pressed live: Sacred Guardian Beast's card 'Shiisaa 0 → 1'.
