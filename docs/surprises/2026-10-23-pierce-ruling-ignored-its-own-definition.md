---
id: 2026-10-23-pierce-ruling-ignored-its-own-definition
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** my grill pick for Vlad's Kazıklı Bey Active 2 (#330 ruling 10), "Invuln and Anti-Purge still stop
it, as they do Active 1's", accepted by the user.
**Actual:** Active 2's damage "has the Pierce and Ignore Def effects", and Pierce's own definition reads "This
Unit's Attacks ignore Invuln and Block". Active 1 names Invuln and Anti-Purge; Active 2 does not, and its Pierce
says the opposite. The ruling I recommended contradicts a term on the same line.
**Cause:** `packs/_source/effects/pierce.yml:5 @ 630495df` — I wrote the pick by analogy with Active 1 and never
read the definition of the effect the clause names.
**Fix:** `packs/_source/abilities/vlad-kazikli-bey-execution.yml:1 @ 2f18de06` — both readings put to the user, who ruled
Pierce wins (#330 ruling 10, corrected); Active 2's `strike` carries `pierce: true`, and only an Anti-Purge stops it.
