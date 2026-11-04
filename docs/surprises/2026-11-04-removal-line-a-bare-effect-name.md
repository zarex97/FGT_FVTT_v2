---
id: 2026-11-04-removal-line-a-bare-effect-name
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** The seal's card says Enuma Elish took what the NP caused.
**Actual:** The card read *"NP Seal (Ea): … Atk Dwn Def Dwn NP Seal (Ea): …"*, which reads as more effects inflicted, on nobody named.
**Cause:** `module/engine/attack.mjs:7739 @ ff814c4b` — the removal's row carried only the effect's name, and its `outcome: "removed"` reached no reader on this card.
**Fix:** `module/engine/attack.mjs @ 96edc10a` — *"Atk Dwn is removed from Rider."*, the Unit by `publicIdentityOf`.
