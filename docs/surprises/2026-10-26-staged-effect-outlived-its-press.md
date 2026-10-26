---
id: 2026-10-26-staged-effect-outlived-its-press
found: live press
kind: drive-kit
status: fixed
reviewed: true
pattern: drive-kit
---
**Expected:** Heracles's Nine Lives on Siegfried would meet Armor of Fafnir and be cut 75% (AF.2.cut).
**Actual:** it dealt 1378 and felled him: no Armor row, *"Dmg Up (Dragon): 60"* in the breakdown. A Dmg Up (Dragon)
I had staged on Heracles a Turn earlier for AF.3.au, with a long expiry, was still on him and made the NP Anti-Dragon.
**Cause:** `docs/superpowers/specs/2026-10-26-siegfried-clauses.md @ 2cfdf9b3` — the drive staged an effect for one
press and never removed it; the engine read it correctly.
**Fix:** `docs/superpowers/specs/2026-10-26-siegfried-clauses.md @ 86d636c5` — the effect removed, Siegfried
restored by the GM, Nine Lives pressed again: *"−75% Total, NP Rank A+"*. A staged effect is removed right after the
press it was staged for.
