---
id: 2026-10-22-conditional-anchor-offers-no-direction
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** Evil Gaze of the Abyss, authored with a `conditional` anchor (a 5x5 branch for the Gigantic Horror,
`otherwise` a 3x3 `selfEdgeAdjacent`), lets Player1 turn its 3x3 east onto the foe, as Blasphemy Aesthetic's did.
**Actual:** the press was refused before any direction was offered: *"No legal targets for this ability. Refused: No
legal targets: Ruler is an ally"*. The area was aimed north, at the ally there.
**Cause:** `packs/_source/abilities/gilles-evil-gaze-of-the-abyss.yml:31 @ uncommitted` — a `conditional` anchor aims
where its holder faces (Drake's Golden Wild Hunt's shape, *"the direction the Golden Hind is facing"*), so the
targeting session drew no direction to choose. I took the anchor for a size switch without reading what it aims at.
**Fix:** `packs/_source/abilities/gilles-evil-gaze-of-the-abyss.yml @ uncommitted` — `targeting.branches`, a whole
targeting block per predicate, keeps `selfEdgeAdjacent` in both; the test now asserts the anchor kind and the size.
