---
id: 2026-10-25-charge-spent-by-an-earlier-np
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** NP DmUp (Round) is spent by the holder's next damaging Noble Phantasm, the one it raised (#336 ruling 5),
as Overcharge is spent by the NP it scaled (#260 reading 8).
**Actual:** Arturia (Lancer) declared Strike Air; one of its Processes waited at its facing step while she used Wild
Hunt and gained the charge. When that Process closed, Strike Air's Combat Phase ended and spent the charge, which
had raised nothing. A charge staged while Rhongomyniad's Phase was open went the same way.
**Cause:** `packs/_source/effects/np-dm-up-round.yml @ 82b7d864` (and `overcharge.yml`) spend on `attackPerformed`,
raised once a Combat Phase is over (`engine/attack.mjs#fireAttackPerformed`), for any NP of the holder's, whenever
it was declared. Nothing ties the spend to an NP declared while the effect was held.
**Fix:** `module/engine/attack.mjs#buildAttackSpec @ 0ce2a0b1` stamps `heldAtDeclaration`, the effect ids its user held
when the Attack was declared; `rules/options.mjs` emits `attack:heldAtDeclaration:<id>`; `np-dm-up-round.yml` and
`overcharge.yml` spend only on it. `test/unit/lanceturia-336.test.mjs` declares Strike Air, gains the charge while it is
open, closes it, and the charge stays; it fails without the predicate.
