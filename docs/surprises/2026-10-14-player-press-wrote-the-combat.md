---
id: 2026-10-14-player-press-wrote-the-combat
found: live press
kind: live-client-only
status: fixed
reviewed: true
pattern: live-client-only
---
**Expected:** Player1 pressing Uncrowned Arms Mastership while its opening choice is owed asks the choice and applies the pick (#206 reading 3).
**Actual:** The prompt came up on Player1's screen; Confirm failed with "User Player1 lacks permission to update Combat" and the whole batch, mode switch included, was refused.
**Cause:** `module/apps/actor-sheet/sheet.mjs:150 @ 95b91ea` — the sheet ran `askOpeningChoices` on the player's own client, whose batch carries a `log` intent that writes the Combat; the unit test drove it as the GM only.
**Fix:** `module/net/operations.mjs @ 95b91ea` — a player's press sends `askOpeningChoice` to the GM, who asks the owner and writes; pressed again live, the pick applied.
