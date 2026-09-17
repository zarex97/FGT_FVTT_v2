# The defeat intent carries its killer, and the defeat write path decides Conquest first

Ch. 32's Conquest — a killed Master's Servants passing straight to the killer's Master — has to be
decided at the moment of death, before anything frees those Servants, because the freeing write
nulls the `masterId` that Conquest selects them by. The write path that frees them knew only *that*
a Unit died and its cause, never *who* killed it, so the defeat intent now carries the killer's
identity (`null` where there is none) and the same function decides both halves.

## Considered options

The alternative was to resolve Conquest in the attack engine, before the defeat intent is emitted,
leaving the freeing path to skip Servants that had already been re-contracted. That keeps the intent
unchanged, and the attack engine already holds the Combat Process and therefore the attacker. It was
rejected because it splits one rule across two engines and reopens the window Ch. 32's own invariant
forbids: between the attack engine's write and the freeing path's, a Free Servant would be briefly
observable, and Ch. 32 requires that no such state exists.

## Consequences

Roughly eleven sites emit a defeat, and several genuinely have no killer — a bounded field's action,
the Nameless Forest death roll, Sustainability exhaustion, a linked partner's death. Those pass
`null` and free their Servants as before, which is correct: a Master who starved to death was killed
by nobody and Conquest needs a claimant. The cost is that every future emission site has to decide
what to pass, and passing `null` where a killer exists fails silently — the Servants simply go Free,
which is the pre-existing behaviour and therefore looks right.
