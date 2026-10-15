---
id: 2026-10-15-this-round-is-not-a-duration
found: test
kind: passes-for-the-wrong-reason
status: fixed
reviewed: false
---
**Expected:** both Circuits' "for the rest of the Round" worked: they are authored `duration: "thisRound"`, and
`content-ticks.test.mjs` is the guard that "every authored span parses" (#195).

**Actual:** `parseTick("thisRound")` throws `RangeError: Cannot parse duration "thisRound"`. The first damaging NP
EMIYA used while holding AC or BC would have thrown inside the Damage Step (reproduced: Hrunting on a Unit with AC held
in the arena, `FGT | Cannot parse duration "thisRound"`). The guard was green the whole time.

**Cause:** `test/unit/content-ticks.test.mjs:19 @ 7231295` — the guard walks keys named `ticks` only, and an
`ApplyEffect` hands `parseTick` its `duration`. `packs/_source/effects/activated-circuits.yml:55 @ 7231295` and
`blazing-circuits.yml:40` authored the one string in the corpus that is neither a ◈ span nor a named event.

**Fix:** `test/unit/content-ticks.test.mjs:19 @ 3cc6a34` — the guard reads `duration` and `defaultDuration` too (it
finds exactly those two); the Circuits say `until roundEnd` (`packs/_source/effects/ac-next-np.yml @ 3cc6a34`).
