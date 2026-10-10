---
id: 2026-10-10-ring-chance-two-readers
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** with the band map fixed, Karna two panels out is Deafened on a 50% chance.

**Actual:** the damage read band 1 (×0.50) and the Deafen still read "rolled 43 vs 85%" — 100% less his
resistance.

**Cause:** `module/engine/attack.mjs:4847 @ 08ea4b1` — the post-damage rider loop states the chance as
`chancePerPanel` or `chance`; the ring's chance was only read in `applyDeclaredEffects`
(`attack.mjs:5297`), a second effect path. The Conch's `applyEffects` goes through the first.

**Fix:** `module/engine/attack.mjs @ d162f50` — `declaredChance`, one reader both paths call.
