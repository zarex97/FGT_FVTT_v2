---
id: 2026-10-12-caster-never-a-contractor
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** Medea, a Caster, may attempt to contract Free Kingprotea.
**Actual:** "notAContractor".
**Cause:** `module/rules/contract.mjs:244 @ 50c5731` read `servantClass`, which no projection writes; the tests built that shape by hand.
**Fix:** `module/rules/contract.mjs:256 @ 81c5732` reads `servantClasses`; tests use the real shape and a Medea subject.
