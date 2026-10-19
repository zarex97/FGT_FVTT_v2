---
id: 2026-10-19-pc7-preview-called-enemy-legal
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** concealed, Yan Qing's Doppelganger pick offers no enemy, as PC.7 per target (#249 reading 14) refuses one at the use.
**Actual:** Player1's aiming session hovered Arturia and said "✓ Legal — click to confirm"; Use then refused "Doppelganger cannot be used: Presence Concealment forbids this while concealed."
**Cause:** `module/engine/skill-use.mjs#resolveSkillTargets @ 27ef5aa0` dropped enemies after the resolver, for the use and `legalSkillTargets` alone; the aiming session (`apps/canvas/targeting-layer.mjs` through `rules/targeting/resolve.mjs#validate`) read the bare spec. Danzō's PC.7 pick was only ever unit-tested (§46.40.3).
**Fix:** `module/rules/concealment.mjs#veiledSpec @ cce1f438` marks the spec, and `rules/targeting/resolve.mjs` step 4 drops the enemies from it; `resolveSkillTargets` and `apps/actor-sheet/sheet.mjs#pickPlacementFor` both build the spec through it.
