---
id: 2026-10-15-handler-cut-unreported
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Castor's Normal Attack crits while he holds the Castor buff. The card says the joint NP lost a Turn on both twins, and shows the Divine Core's 5% die.
**Actual:** the joint NP fell 7 → 6 on both copies. The card showed the damage and its ladder, nothing else. The Turn's end took 2 off both copies for Self-Replenishment, and its card named only "Castor regains 40 Health".
**Cause:** `module/engine/attack.mjs#fireDamageStepEnd @ 960496f` applied its handlers' intents and returned nothing, and rolled its chances without filing them; `module/engine/turn-report.mjs#turnEndCard` read Health and modes only, and `CooldownDelta` carried no source to name.
**Fix:** `module/engine/attack.mjs#applyWithCooldownLines @ 3cc6a34` — one reader for the attack path's cuts, a line per copy; the Damage Step's end files its chance dice; the Turn-end card names each sourced cut (`FGT.TurnReport.CooldownCut`); a chance die is named for its handler (`pendingRolls` carries `source`), not "rider".
