---
id: 2026-10-23-kill-heal-missed-a-revived-kill
found: live press
kind: rule-word-read-one-way
status: fixed
reviewed: false
---
**Expected:** Dracula Vlad's hit took Heracles to 0 (R52, 268 on 136): "each time he defeats a Unit, his Health and
Agility is restored by 25%", which ruling 16 counts for a Unit that is then revived.
**Actual:** "Berserker is defeated and revived by God Hand"; Vlad gained his two damage heals (800 → 1000, Agility
15 → 17) and no 25%.
**Cause:** `packs/_source/effects/legend-of-dracula-activated.yml:70 @ uncommitted` listened on `unitKilled`, which
`engine/attack.mjs#killedBy` fires only when the revival chain ends in a death ("a Servant Guts saves was not
killed"): the event's name was read as "defeats", against the ruling just made.
**Fix:** `module/engine/attack.mjs#killedBy @ uncommitted` also fires `unitFelled` whenever the hit took the victim to 0,
before `unitKilled`; the `defeat` phase fires both; Dracula's kill heal listens on `unitFelled`.
