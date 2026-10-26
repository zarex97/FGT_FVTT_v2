---
id: 2026-10-25-mark-created-on-player-client
found: user
kind: live-client-only
status: fixed
reviewed: true
pattern: live-client-only
---
**Expected:** Medusa's player presses Mark on her action bar in a real War and a Bloodmark lands on her panel
(#188, pressed at its audit).
**Actual:** Playing War "EMIYA vs Heracles" as Player2, the user reported: *"I am trying to place Medusa's mark on
the map but its saying I lack permissions to create the actor"*.
**Cause:** `module/engine/marks.mjs:53 @ cc1d8e41` — `placeMark` ran on the pressing client and called
`Actor.createDocuments` and `createEmbeddedDocuments("Token")` there. A player may create neither. Every other
press that writes documents a player cannot (`ridingAttack`, `useSkill`) asks the GM first; the Mark did not.
**Fix:** `module/engine/marks.mjs:53 @ d3452f94` — a player's `placeMark` asks the GM through the new
`OPERATIONS.placeMark` (`module/net/operations.mjs:222 @ d3452f94`), authorized to the marker's owner and an
ability she holds, then redraws mark sight on its own client. Not yet pressed live as Player2.
