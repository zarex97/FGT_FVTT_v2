---
id: 2026-10-23-civilian-heal-paid-twice
found: live press
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** Dracula Vlad kills a Civilian (R54): *"if he defeats a Civilian, he only heals 100 Health and 1
Agility"*, plus 100 and 1 for the ally the same Attack damaged.
**Actual:** "Civilian A is defeated by Lancer."; he gained 300 Health and 3 Agility.
**Cause:** `packs/_source/effects/legend-of-dracula-activated.yml:78 @ uncommitted` added a Civilian heal of its own;
Ch. 06's bounty (`module/rules/environment.mjs:634`) already pays every Servant 100 and 1 for a Civilian. I wrote the
clause from the sheet and never read the path that kills a Civilian; ruling 16's wording carried the same miss.
**Fix:** the Civilian handler is gone: the bounty is the "only", in place of the 25%.
