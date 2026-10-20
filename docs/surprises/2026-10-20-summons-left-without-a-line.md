---
id: 2026-10-20-summons-left-without-a-line
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** When Gilles is defeated his Horrors and Elder Horrors disappear (HO.leave, EH.leave, #260), and the table is told, as every outcome a player must know is.
**Actual:** Pressed live: Heracles defeated him and six Horrors and an Elder Horror vanished from the board. Player1's chat read only "Saber is defeated by Berserker."
**Cause:** `module/engine/io.mjs:1234 @ 48916996` — `io.defeat` dismisses every `leavesWithSummoner` summon, and `dismissSummon` records a `summonDismissed` log entry and posts nothing. Medea's Dragon Tooth Warriors (#193 reading 15) have left the same way since that reading.
**Fix:** `module/engine/io.mjs:1240 @ uncommitted` — before the dismissal, `postLeftWithSummonerCard` (`module/engine/defeat-card.mjs`) posts "2 × Horror, Elder Horror leave the field with Saber.", by public names, the fallen ones left out.
