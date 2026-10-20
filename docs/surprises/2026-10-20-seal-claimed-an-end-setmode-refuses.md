---
id: 2026-10-20-seal-claimed-an-end-setmode-refuses
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Revised Mad Enhancement clause 7, *"if this Unit is inflicted with Skill Seal while ME is
Active, it is immediately deactivated"*, ends every bearer's mode the War plays it on.

**Actual:** Heracles is *"Constantly Active. Cannot be deactivated."* As first written, the seal reader
would have printed "Berserker's Mad Enhancement is deactivated by Skill Seal." while `io.setMode` refused
the switch, leaving the mode on under a card that said otherwise. Caught while staging the press.

**Cause:** `module/engine/seal-ends.mjs#sealVerdicts @ ca41d4ab` decided "ends" from the revision alone;
`module/engine/io.mjs#setMode @ 48916996` is the other reader of "may this mode switch off", and its
`cannotDeactivate` refusal beats every forced switch.

**Fix:** `module/engine/seal-ends.mjs @ ca41d4ab` holds a `cannotDeactivate` mode with its own line
("cannot be deactivated: Skill Seal leaves it Active"), pressed live on Heracles. Which rule wins — the
Revised clause or his sheet's "cannot be deactivated" — is a reading put to the user.
