---
id: 2026-10-17-contract-attempt-on-player-client
found: live press
kind: live-client-only
status: fixed
reviewed: true
pattern: live-client-only
---
**Expected:** Player1 presses Attempt on the Free Lancer in the Contract dialog of the Master of Rider
of Faction 1; the Contract forms, automatically, an ally contracting a Free Servant.
**Actual:** nothing, and no message. Run by hand on the same client: *"User Player1 lacks permission to
update Combat [83tk8YBPPFhpkskP]"*.
**Cause:** `module/apps/contract-dialog.mjs:85 @ b0313abf` — the dialog called `attemptContract` on
the player's own client, whose batch writes the match log on the Combat; only the GM may. The handler's
rejection went nowhere.
**Fix:** `module/net/operations.mjs#attemptContract @ b0313abf` — the attempt is a socket operation run
on the GM, authorized for the contractor's owner, as `spendCommandSpell` is.
