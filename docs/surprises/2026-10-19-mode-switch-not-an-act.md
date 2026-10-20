---
id: 2026-10-19-mode-switch-not-an-act
found: live press
kind: rule-word-read-one-way
status: fixed
reviewed: false
---
**Expected:** pressing #194, Penthesilea switching Mad Enhancement on is using an ability, so her Master loses 30 at that Turn's end (#190 reading 6: *"a Turn she Moved, Attacked or used an ability"*).
**Actual:** her Master stayed at 243; a later Turn she only Evaded cost 30. The Turn record read no `acted`.
**Cause:** `module/apps/actor-sheet/sheet.mjs#toggleMode @ 856a58ff` — a free mode switch wrote the item and nothing on the Turn record; `countsAsAct` is asked only on `useSkill`'s path.
**Fix:** `module/apps/actor-sheet/sheet.mjs#toggleMode @ uncommitted` — ruled 2026-10-19 that switching a mode on is an Act: it marks `acted` while the clock runs. Pressed live: switched on at tick 13, `acted: true`, *"Master of Berserker of Red loses 30 Health (Mad Enhancement)"*, 243 → 213.
