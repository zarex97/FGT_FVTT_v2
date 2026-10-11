---
id: 2026-10-10-zon-reads-servant-master-zone
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** Medusa, stolen by Medea, has a Rider's ZON of 2 around her (reading 19).
**Actual:** `zon: 6`.
**Cause:** `module/rules/zon.mjs:120 @ 27c8858` read `master.zon` as a Master's stated ZON. On Medea that field holds her OWN zone around her Master, 5, which `annotateZon` writes into the same name, plus a rank bonus. The same pass also nulled every Master's stated `zon`, so a Servant annotated after its Master lost the stated floor.
**Fix:** `module/rules/zon.mjs @ 40e21e7` — stated ZON and rank count only for a non-Servant Master, and `annotateZon` writes `zon` only on Servants. `test/unit/medea-193.test.mjs` covers both.
