---
id: 2026-10-15-on-removal-was-the-clocks
found: test
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** "when Atk Up (Trace) is removed from him, remove AC/BC" is `onRemove`, and it ran whenever the buff went.

**Actual:** it ran when the buff ran OUT. A Cure, a strip, a dispel or an `until <event>` deleted it and left the
Circuits. (Shock's "current Agility +1 when max is restored" had the same blind spot.)

**Cause:** `module/engine/scheduler.mjs:2207 @ 7231295` — `expireEffects` was the only caller of `onRemoveIntents`.
`applier.mjs`'s `removeEffect` case, where every removal meets, ran none.

**Fix:** `module/engine/applier.mjs:304 @ d9a77c1` — `resolveRemovals` pays the clause for every removal that is not an
expiry (flagged `onRemoveRan`), a refresh or a replacement. Ruled 2026-10-15: any removal removes AC and BC.
