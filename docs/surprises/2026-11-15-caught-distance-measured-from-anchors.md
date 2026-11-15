---
id: 2026-11-15-caught-distance-measured-from-anchors
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** A caught Unit's `distance` is Chebyshev footprint to footprint, as Range is: a 2x2 Unit whose near panel
is two panels from the attacker reads 2 (the Godot port's Clause S04.CH.2).
**Actual:** Pressed in the Godot port, which matches this engine case for case: a Range 2 Normal Attack on a 2x2
Colossus whose near panel was two away was legal, and its preview read "Colossus (distance 3.0)".
**Cause:** `module/rules/targeting/resolve.mjs:1583 @ 28878f91` (`toTargeted`) measured `chebyshev(caster.panel,
u.panel)`, anchor to anchor, while Range is footprint to footprint (`geometry.mjs#occupiedPanels`). The `nearest`
chooser sorts by it, so a large Unit could be passed over for a smaller one that is further away.
**Fix:** `module/rules/targeting/resolve.mjs @ uncommitted` measures `chebyshevBetween(occupiedPanels(caster),
occupiedPanels(u))`; `test/unit/targeting.test.mjs` holds the case; the Godot port follows.
