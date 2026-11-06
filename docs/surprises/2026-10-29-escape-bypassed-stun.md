---
id: 2026-10-29-escape-bypassed-stun
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Carolus Patricius's escape is an action in place of the Move, so whatever stops a Move stops it.

**Actual:** A Stunned Hassan was offered the escape and rolled it: "Assassin 1 fails to escape Carolus Patricius: Luck Check 10 vs 4."

**Cause:** `module/rules/platforms.mjs:1690 @ 5d91e76f` — `escapeVerdict` asked relation, kind and `moved`, never `preventedBy`, the gate every Move door asks.

**Fix:** `module/rules/platforms.mjs:1700 @ 5d91e76f` — refuses `cannotAct` when `preventedBy(unit, "move")`; the bar keeps it listed, blocked.
