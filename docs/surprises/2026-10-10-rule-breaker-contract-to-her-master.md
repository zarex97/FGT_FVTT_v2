---
id: 2026-10-10-rule-breaker-contract-to-her-master
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** Rule Breaker gives Medusa's Contract and three Command Spells to Medea (reading 18).
**Actual:** Medusa's `masterId` became Medea's Master, and the three spells went to him.
**Cause:** `module/engine/attack.mjs:6005 @ 27c8858` assumed a Master is always a `master` actor and passed the Contract up to the caster's Master. The Servant DataModel also had no `commandSpellsPerServant`, so a grant to a Servant had nowhere to land.
**Fix:** `module/engine/attack.mjs:6009 @ uncommitted` makes the caster the new Master. `module/data/actor/servant.mjs` declares the field, and the snapshot projects it. Live: Medusa's Master is Medea, and Medea holds 3 spells for her.
