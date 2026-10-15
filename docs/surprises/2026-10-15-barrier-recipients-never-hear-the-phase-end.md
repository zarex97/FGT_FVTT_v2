---
id: 2026-10-15-barrier-recipients-never-hear-the-phase-end
found: test
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** with Rho Aias's duration changed from `⅓◈` to `until combatPhaseEnd`, the barrier is gone after the Noble
Phantasm it answered, from everyone who holds it.

**Actual:** (the arena test, with the sweep switched off) the Unit in the 3x3 that the Noble Phantasm never hit kept
`rhoAias` for good: `expected [ FakeEffect{…} ] to have a length of +0 but got 1`. An effect with `endsOn` has no clock;
the only thing that removes it is the event, and a Unit hears `combatPhaseEnd` only if the Phase named it.

**Cause:** `module/engine/attack.mjs:2890 @ 7231295` — `fireCombatPhaseEnd` fires on the attacker and the defenders of the
fan-out. A barrier raised by a third party reaches a 3x3 of allies, and the projector, who are none of them.

**Fix:** `module/engine/attack.mjs:2931 @ 3cc6a34` — `barriersOfThisPhase` removes the effect from every Unit the
Phase did not name that holds one cast by a Unit that took a reaction in it.
