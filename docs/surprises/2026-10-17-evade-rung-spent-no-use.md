---
id: 2026-10-17-evade-rung-spent-no-use
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Het Gele Huis's *"Applies Evade for 1◈ Turns, 1 time"*: the first Attack she Evades with it spends it.
**Actual:** Round 3 tick 8, Asterios attacked her, Player1 chose Evade: "evade automatic success", and her `evade` still held `uses: 1`, exp 10.
**Cause:** `module/engine/attack.mjs:1612 @ 8d1c012f` — the plain Evade rung (`rollEvade` → `evadeCheck`) takes a plan's `AutoSucceed` and spends nothing; only the reaction-ability path (`autoEvadeFrom`, Trofa) consumed a use. Every count-limited Evade or Dodge reached through the Evade button lasted its whole duration.
**Fix:** `module/engine/attack.mjs` `spentBy` @ 05211bb1 — the rung returns which effect it spent and the caller consumes a use, Dodge first as `evadeCheck` takes it.
