---
id: 2026-10-10-band-map-overwritten
found: live press
kind: name-collision-on-spread
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** Triton's Conch deals Karna, two panels from Nemo, 0.5x and a 50% Deafen — the targeting
dialog itself read "Karna … band 1".

**Actual:** Karna's card: "Band band band 0 +1.5", and "Deafen (rolled 41 vs 85%)" — the inner ring's
100% less his resistance.

**Cause:** `module/engine/attack.mjs:338 @ 08ea4b1` stored the per-target ring map as `attack.bands`;
`expandInstances` spreads the damage block, whose `bands` is the multiplier list, over every Process's
attack at line 980. The list replaced the map, and `bands[defender.id]` was `undefined` → ring 0 for all.
Heracles, in ring 0, could not show it.

**Fix:** `module/engine/attack.mjs:344 @ d162f50` — the map is `bandOf`, read at the damage and
effect sites.
