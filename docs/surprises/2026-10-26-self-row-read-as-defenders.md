---
id: 2026-10-26-self-row-read-as-defenders
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Siegfried's player reads Balmung's own NP Regen (Balmung) row by name: it lands on him.
**Actual:** Player1's card read *"1 effect(s) applied"*, both when it landed and when it was refused, while the GM's
read *"NP Regen (Balmung): noop, counted none"*. A count where nothing was applied.
**Cause:** `module/engine/attack.mjs:7510 @ 86d636c5` — `applyDeclaredEffects` returned rows with no Unit, and
`rules/card-visibility.mjs#effectsFor` reads a row with no Unit as the defender's, so the attacker's player saw a count.
**Fix:** `module/engine/attack.mjs:7515 @ 069ec83a` — each row carries its recipient; a `target: self` row is its user's.
`effectLine` says *"not applied"* for `noop` (`module/rules/card-visibility.mjs`). Pinned in `siegfried-341.test.mjs`.
