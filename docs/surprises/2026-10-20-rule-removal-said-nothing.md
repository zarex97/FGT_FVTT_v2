---
id: 2026-10-20-rule-removal-said-nothing
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Soaked (b) and (c): Fire uses it up, a Day Round's end dries it. A player whose Unit loses Soaked reads it on a card: it decides the next Freeze roll.
**Actual:** Round 3 (Day) ended: Nemo's and Medea's Soaked gone, and the Round's card read only *"Archer takes 50 from Burn, Berserker takes 50 from Burn"*. Barrel Bombing's card z4Q31utMumgCZhbi halved the Fire and said nothing of the Soaked it took.
**Cause:** `module/engine/applier.mjs:133 @ 50eae993` — the applier lines clocks, stats, spans, items and suppressions, and no removal: a `RemoveEffect` an event rule wrote reached no card anywhere (Webbed broken by a hit, a Curse spent, Soaked).
**Fix:** `module/engine/applier.mjs#removalLines @ 0552085c` — a removal an event's rule makes (`byRule`, from `scheduler.mjs`'s `RemoveEffect`) is a line, *"Soaked: removed"*; an expiry is not. `anastasia-258-rulings.test.mjs`, red before.
