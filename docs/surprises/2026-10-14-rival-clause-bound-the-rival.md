---
id: 2026-10-14-rival-clause-bound-the-rival
found: user
kind: sheet-binds-only-its-owner
status: fixed
reviewed: true
pattern: sheet-binds-only-its-owner
---
**Expected:** I recommended that Karna's Fated Rivals, *"they will only Attack each other"*, also force Arjuna to Attack only Karna (#206, grill Q2c).
**Actual:** The user ruled that Arjuna's side is whatever Arjuna's own sheet says: "That's something you will see when you read Arjuna's sheet."
**Cause:** `packs/_source/abilities/karna-fated-rivals.yml:375 @ 4588084` — the content already bound Karna alone; I read one Servant's sheet as authority over another Unit's behaviour.
**Fix:** `FR.arjuna` dropped from #206's Clause list and named under *Not Clauses* (118 Clauses). Karna's passive binds Karna only; no code changed.
