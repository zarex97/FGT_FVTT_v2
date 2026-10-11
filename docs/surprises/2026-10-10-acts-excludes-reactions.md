---
id: 2026-10-10-acts-excludes-reactions
found: user
kind: precedent-carried-without-asking
status: open
reviewed: true
pattern: precedent-carried-without-asking
---
**Expected:** I recommended that Tenmōkaikai's upkeep, *"any Turn Raikou or any of her copies Acts"*, leave Evade and Block out. That matched #190 reading 6, which I took as settled.
**Actual:** The user ruled that evading and blocking count as Acting. That contradicts #190 reading 6 for Penthesilea's Mad Enhancement drain.
**Cause:** `module/engine/attack.mjs:188 @ 27c8858` and its siblings write `acted: true` for Moves, Attacks, abilities and Counters only. Nothing on the react rung writes it. I carried that one-Servant reading into a new sheet as if it were a house rule.
**Fix:** Open, in #194: re-rule #190 reading 6, mark `acted` on Evade and Block, and press Penthesilea's `ME.drain.idle` again. Raikou's audit #195 carries it as reading 12.
