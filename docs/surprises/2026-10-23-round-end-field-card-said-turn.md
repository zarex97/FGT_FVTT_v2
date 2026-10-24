---
id: 2026-10-23-round-end-field-card-said-turn
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Kazıklı Bey's Round-end tick (#330 ruling 7) on a card a player reads as the end of the Round.
**Actual:** R46's end: the card read "Kazıklı Bey: end of the Turn", the title every Turn-end field card uses, on the
tick that fired because the Round ended (Vlad had not Acted that Turn).
**Cause:** `module/engine/scheduler-hooks.mjs:528 @ uncommitted` — the new `roundEnd` dispatch posted its report with
`postFieldReports`' default title.
**Fix:** `module/engine/scheduler-hooks.mjs:530 @ uncommitted` passes `FGT.FieldReport.RoundTitle`, "{field}: end of the
Round"; a hit an Invuln or Anti-Purge stopped prints "{who} takes no damage: {by}".
