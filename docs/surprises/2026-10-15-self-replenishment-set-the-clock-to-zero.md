---
id: 2026-10-15-self-replenishment-set-the-clock-to-zero
found: test
kind: assumed-shape
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** firing `unitTurnEnd` on real Castor yields a `reduce` of 2 Turns on his NP (and, after #219, on Pollux's). The ticket's `C10` test had pinned the table (`selfReplenishmentCooldown` D = 2).
**Actual:** the cut came out as `mode: "set", ticks: 0`: the projected action is `{ kind: "CooldownDelta", scope: "np", direction: "down", amount: 2 }`, and at every Turn end Castor's Noble Phantasm would have come back.
**Cause:** `module/engine/scheduler.mjs:1185 @ 7231295` — `CooldownDelta` read `ticks`, then `delta`, and a rank table arrives as `amount` plus `direction` (the shape `StatDelta` reads at `:1024`). Nothing ran Self-Replenishment's projected action, only its authored table.
**Fix:** `module/engine/scheduler.mjs:1198 @ 67e91e1` — `CooldownDelta` reads `amount` and `direction` as `StatDelta` does. `dioscuri-209-rulings.test.mjs` ("Self-Replenishment REDUCES the NP clock by 2 Turns") fails without it.
