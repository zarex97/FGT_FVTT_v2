---
id: 2026-10-14-damage-step-end-doc-says-zero
found: test
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** `docs/E-event-reference.md` §E.3: *"`fgt.damageStepEnd` fires **even when zero damage was dealt**"*, so Alpi on it pays for a Block or a hit for 0, as reading 12 rules.
**Actual:** The code fires it only on damage: `if (!skipped && result.total > 0) await fireDamageStepEnd(state, result)`.
**Cause:** `module/engine/attack.mjs:2935 @ 4983091` — the guard and the reference disagree; nine other listeners (Castor, Sikera Usum, Vorpal Blade, the Circuits, Enigma) are built on the code's reading.
**Fix:** `module/engine/attack.mjs:2994 @ cde0483` — ruled 2026-10-14: the reference stands. `damageStepEnd` fires when `ridersFire` says the hit landed, 0 damage included. Alpi stays on `attackLanded`.
