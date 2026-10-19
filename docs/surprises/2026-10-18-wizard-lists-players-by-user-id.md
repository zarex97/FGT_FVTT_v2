---
id: 2026-10-18-wizard-lists-players-by-user-id
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** the setup wizard's Factions tab names each faction's players, "Player1" and "Player2".
**Actual:** it printed raw user ids: "Players yVevT9Da3egFpXeO" and "Players vL77HYG9fUm8uOwI", seen while shooting the beginner's guide.
**Cause:** `templates/apps/setup-wizard-factions.hbs:12 @ b7005fed` — the template looped `faction.userIds` and printed each id; nothing resolved an id to a user's name.
**Fix:** `module/apps/setup-wizard.mjs:200 @ 12f979b2` — the context maps each faction's `userIds` to `playerNames`, and the template prints those.
