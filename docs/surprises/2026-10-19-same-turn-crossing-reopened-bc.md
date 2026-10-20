---
id: 2026-10-19-same-turn-crossing-reopened-bc
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** Battle Continuation's *"Health must have been restored back to above half its maximum value at least once since the last activation"*: healed above half at tick 11, revived by it at tick 11, its Cooldown staged off, killed again at tick 11 with no restore between: refused, God Hand next.
**Actual:** *"Berserker is defeated and revived by Battle Continuation, with 49 Health."* twice in tick 11; God Hand's `timesUsed` stayed 10.
**Cause:** `module/rules/revival.mjs:112 @ d64553fc` — the gate reads `at < last`, a crossing's tick against the activation's, and both were 11. Any Unit above half that falls and is revived in one Turn has its crossing stamped at the activation's own tick, so once the Cooldown ends the gate is open without a restore.
**Fix:** `module/engine/io.mjs:939 @ ded45740` — `recordUse` wipes the mark for the fractions the ability asks about when it fires, so only a crossing after the activation opens the gate again. `test/unit/heracles-256-rulings.test.mjs`.
