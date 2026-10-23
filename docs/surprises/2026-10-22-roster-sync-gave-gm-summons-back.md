---
id: 2026-10-22-roster-sync-gave-gm-summons-back
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** once the Gigantic Horror is the GM's, its player only watches it and every summon of it (#323 reading
12g); `io.takeForm` turned the existing ones to Observer.
**Actual:** the four Horrors it summoned in the GM's slot ("4 summoned (1d4 → 2 …)") were Owner for Player1.
**Cause:** `module/engine/faction-ownership.mjs:102 @ d97795b9` — `syncOne`, run on every new actor, writes Owner for
the faction's players from the roster alone; `io.takeForm` was a second writer of the same ownership that knew the
GM rule, and this one did not.
**Fix:** `module/engine/faction-ownership.mjs:104 @ uncommitted` — `syncOne` asks `control.mjs#gmControlled` and writes
Observer for a GM-driven Unit and its summons; test "its player only watches it and every summon of it, the roster's
sync too (12g)".
