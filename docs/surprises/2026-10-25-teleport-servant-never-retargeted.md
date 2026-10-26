---
id: 2026-10-25-teleport-servant-never-retargeted
found: user
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** The rulebook (Rules – Relationships): *"When CS: Teleport Servant is used by a Master when it is
Attacked, the AU's target is switched to the newly-teleported Servant. The newly-teleported Servant cannot use Evade
or Block in this Combat Process."*
**Actual:** The user: *"I uses a teleport command seal to recieve an attack in palce of medusa's master, and the
master ended up receiving it"*. Medusa landed beside her Master, the Master took EMIYA's 165, was Overpowered, and
Medusa was taken by Conquest to Faction 1.
**Cause:** `module/engine/command-spells.mjs:550 @ cc1d8e41` — `interruptsOf` made a teleport an `escape` when it
moved the defender, and nothing otherwise. `combat-process.mjs#applyInterrupt` has had a `retarget` case, Evade and
Block forbidden, that no command produced. The resume then sent `done` to a `react` rung, an illegal transition, once
the retarget left that rung with no choice.
**Fix:** `module/engine/command-spells.mjs:563 @ d3452f94` — a teleport that brings the attacked Master's own
Servant, spent by that Master before the damage, is a `retarget`; the card is retitled to the new defender; an empty
reaction rung resumes with `nothing`. Test: `test/unit/teleport-servant-retarget.test.mjs`. The live board was
corrected by hand: the defeat and Conquest undone, the hit (165, Injury 2) put on Medusa. Not yet pressed live.
