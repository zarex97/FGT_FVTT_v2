---
id: 2026-10-14-master-protection-limit-unread
found: test
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Gate of Skye's `targeting.limits.ignoresMasterProtection: true` lets her target a Master however near its Servant stands, and turns Cover off, as its comment quotes the sheet: *"the effect of the NP is applied to the Master (Servant unable to interfere)"*.
**Actual:** Nothing reads the key. A grep of `module/` and `test/` for `ignoresMasterProtection` finds no reader, only the content line.
**Cause:** `packs/_source/abilities/scathach-gate-of-skye.yml:60 @ da0dc77` — written under `targeting.limits`, a raw object the field ledger cannot see into, so no guard noticed it had no reader.
**Fix:** `packs/_source/abilities/scathach-gate-of-skye.yml:69 @ uncommitted` — the key is the resolver's `bypassMasterProtection`, and the Cover half is `damage.noCover`. `test/unit/targeting-limits-read.test.mjs` names any limit nothing reads.
