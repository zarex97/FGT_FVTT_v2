---
id: 2026-10-16-skill-card-named-no-recipient
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Librarian of Stored Knowledge's card, used by Hassan 2 with Passive 2 sharing to Hassan 1 and Hassan 3, says who got each buff.
**Actual:** "NP Regen, Crit Up, Buff ChUp, Crit DmUp, Crit Up, Buff ChUp, Crit DmUp, Crit Up, Buff ChUp, Crit DmUp", no names. The buffs were right on the bodies.
**Cause:** `module/engine/skill-use.mjs:1318 @ 907b345` — `postCard` printed each row's effect line and dropped the `unitId` every row already carried; only `statChange` named its recipient itself.
**Fix:** `module/engine/skill-use.mjs:1318 @ uncommitted` — a row landed on anyone but the caster is prefixed with the recipient's name; a row is shown only to its controllers.
