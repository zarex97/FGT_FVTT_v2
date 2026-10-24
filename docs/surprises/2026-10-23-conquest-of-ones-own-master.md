---
id: 2026-10-23-conquest-of-ones-own-master
found: live press
kind: role-keyed-on-type
status: fixed
reviewed: false
---
**Expected:** Legend of Dracula kills his Master inside Wallachia, and Vlad plays on with no Master (#330 ruling 12).
**Actual:** R50, card "Conquest: Lancer is now contracted to Master of Saber of Faction 1 and fights for Faction 1.
Master of Saber of Faction 1 gains 3 Command Spell(s) usable only on Lancer." — he was re-contracted to the Master he
had just killed, who lay defeated.
**Cause:** `module/rules/contract.mjs:185 @ 630495df` — Conquest asked who claims for the killer (its own Master) and
never whether the dead Master was that very Master: a killer's role read off its `masterId`, not off the contract it
was breaking.
**Fix:** `module/rules/contract.mjs:189 @ uncommitted` — a Servant that kills its own Master conquers nobody
(`ownMaster`); its Servants go Free, with the card "No Conquest: {killer} killed its own Master".
