---
id: 2026-10-20-master-death-said-nothing
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** His Master's death under Revised Mad Enhancement (ME.5, WR.me.rev, #260) frees him, keeps his clock whole, locks Mad Enhancement and adds a Turn of decay, and the table is told.
**Actual:** Pressed live: every write landed (Free, 9 Turns, `sustainabilityDecay` 1, `modesLocked`). Player1's chat read "Master of Saber of Faction 1 is defeated by Berserker." and "No Conquest: ...", and nothing about Gilles.
**Cause:** `module/engine/io.mjs:1870 @ 48916996` — `freeContractedServants` applies `onMasterDefeated`'s descriptors as writes and posts nothing. Every Free Servant has been freed in silence, Classic's −2◈ included.
**Fix:** `module/engine/io.mjs:1194 @ ca41d4ab` — the descriptors are worded by `freedLines` and posted after the defeat and Conquest cards; `onMasterDefeated` names the clause 5 it played as a `note` (`module/rules/relationships.mjs:272`).
