---
id: 2026-10-12-caster-never-a-contractor
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** Medea, a Caster, may attempt to contract Free Kingprotea.
**Actual:** "notAContractor".
**Cause:** `module/rules/contract.mjs:244 @ 08ea4b1` read `servantClass`, which no projection writes; the tests built that shape by hand.
**Fix:** `module/rules/contract.mjs:256 @ 98f05ca` reads `servantClasses`; tests use the real shape and a Medea subject.
