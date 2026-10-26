---
id: 2026-10-25-reply-wait-shorter-than-windows
found: user
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Raising War "EMIYA vs Heracles"'s `reactionTimeout`, `interruptTimeout` and `commandSpellTimeout` to
180 s gives players three minutes a window and changes nothing else.
**Actual:** After a player's reaction the user got *"not getting GM advanceProcess or advance response in 60s"*.
**Cause:** `module/net/socket.mjs:79 @ cc1d8e41` — `FGTSocket.request` waited a flat 60 s for the GM's reply. The
GM's `advanceProcess` runs on to the next rung, and `module/engine/attack.mjs:5016 @ cc1d8e41` (`awaitInterrupt`)
holds that rung for `commandSpellTimeout`. The reply wait was a second reader of the windows' length that never read
them: at 15 s windows it fit the minute, at 180 s it did not.
**Fix:** `module/net/socket.mjs:71 @ d3452f94` — `FGTSocket.replyBudgetMs(war)` is 60 s plus four of the War's
longest window, read through the router's `ruleFor` (`warRule`, handed in by `module/fgt.mjs:146 @ d3452f94`,
since `net/` sits below the engine). 780 s for this War. Not yet pressed live.
