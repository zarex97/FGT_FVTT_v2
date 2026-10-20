---
id: 2026-10-20-counter-priced-clock-before-count
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** Summoning: Horrors made as a Counter starts its *"(Number of Horrors x ⅔◈)"* clock, as it does from the bar on his own Turn: two Horrors, 4 Turns (HO.counter, #260).
**Actual:** Pressed live as Player1 on Heracles's Turn: two Horrors came at (9,5) and (8,6), and the Spell's `cooldown.remaining` stayed 0.
**Cause:** `module/engine/attack.mjs:4954 @ 48916996` — `runCounter` pays the ability's price, cooldown included, before the phases run. `cooldownFor` prices a `perUnit` clock by a count that does not exist yet, so it priced 0 Horrors: no clock. `useSkill` sets its clocks after `runPhases`, so only the Counter path missed it.
**Fix:** `module/engine/skill-use.mjs:2339 @ ca41d4ab` — `resolveWithoutProcess` sets the `perUnit` clock once the phases have summoned, unless the use was made on the Cooldown; `runCounter` passes `overCooldown` (`module/engine/attack.mjs:4982`).
