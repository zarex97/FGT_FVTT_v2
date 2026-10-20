---
id: 2026-10-19-never-off-mode-stayed-off
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** reading 2 (#256): Heracles' Mad Enhancement, suspended by a Command Spell at tick 5 for 1◈, is on again at tick 8.
**Actual:** at tick 8 `active: false`, `suspendedUntil: 8`, and nothing switched it back; Player1's bar had read *"Mad Enhancement is suspended and cannot be switched on yet."* through tick 7. Off for good, it would have left Bravery usable for the rest of the War.
**Cause:** `module/engine/modes.mjs:98 @ d64553fc` — the lapse back on is `reconcileForcedModes`, which re-arms only a mode held by a compulsion or a `ForceMode` (Penthesilea, Raikou). A `cannotDeactivate` mode has neither; `engine/io.mjs` even says so, for the forced path it closed in §46.4-B.
**Fix:** `module/rules/modes.mjs:381 @ ded45740` — `lapsedConstantModes`: a never-off mode a suspension switched off is re-armed once the span has passed, with a card (`FGT.Mode.SuspensionLapsed`). `test/unit/heracles-256-rulings.test.mjs`.
