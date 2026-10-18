---
id: 2026-10-17-disable-left-evade-and-block
found: user
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Ruled (#247 readings 4, 17, 18): a Unit under Disable, or under any effect forbidding all Actions, can neither attack, Block nor Evade.
**Actual:** Only `cannotAct` said so, by a `ForbidReaction` line of its own; Stun, Stop, Freeze, Petrify, Sleep, Nightmare, Coma, Webbed, Crystalfreeze and Disable refused the Counter through `canAct` and left Block and Evade on the rung.
**Cause:** `module/rules/snapshot.mjs @ eebbb988`: `forbiddenReactions` read only `ForbidReaction` contributions, while `canAct` read the definitions' `preventsAction`. Two readers of "may this Unit act".
**Fix:** `module/rules/snapshot.mjs @ uncommitted`: any effect that prevents Acting adds evade, block and counter; `cannot-act.yml` drops its own line. Live: a Disabled Drake's card drew no reaction.
