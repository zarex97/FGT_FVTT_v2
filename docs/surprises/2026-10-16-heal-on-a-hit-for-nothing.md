---
id: 2026-10-16-heal-on-a-hit-for-nothing
found: live press
kind: rule-word-read-one-way
status: fixed
reviewed: true
pattern: rule-word-read-one-way
---
**Expected:** Avalon in her Master heals him at "the end of a Damage Step that damaged" him (#230 reading 17); his own Avalon cutting Medusa's hit to 0 heals nothing.
**Actual:** the log read "damage total 0" then "event: Master of Saber of Faction 1 … damageTaken, source [Avalon]": the handler ran. He stood at full Health, so nothing showed; one Health short, he would have gained 20%.
**Cause:** `module/rules/damage/riders.mjs:43 @ b4464ed` — `damageTaken` fires on every hit, 0 included, by the author's ruling for riders (#204, "hit, not hurt"); Avalon's three handlers listened to it with no amount, reading "damage received" one way where the sheet means the other.
**Fix:** `packs/_source/abilities/avalon.yml:85 @ 9d0ab57` — `eventFilter: { amount: positive }` on each, the existing event filter (`scheduler.mjs#eventFilterPasses`). Arena test fires 0 and 40.
