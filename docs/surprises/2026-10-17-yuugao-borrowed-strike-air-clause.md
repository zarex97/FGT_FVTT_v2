---
id: 2026-10-17-yuugao-borrowed-strike-air-clause
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** Danzō's grill, Round 1 Q21: Yuugao's damage takes Strike Air's shape, a fixed figure "none of her modifiers apply" to, and Ignore Def leaves every other defender reduction on.
**Actual:** Strike Air's sheet states its own exemption, *"Not affected by any damage modifying effects on Arturia"*; Yuugao's states none, only *"Deals damage equivalent to the DU's current Health that has the Ignore Def effect"*. And Ignore Def is *"Attacks by this Unit ignore the target's Def Up"*, not every defence.
**Cause:** `packs/_source/abilities/arturia-strike-air.yml:3 @ 27c1e9c2` — the recommendation cited the build's `bypassModifiers.attacker` as the precedent without reading the sheet clause that built it; `packs/_source/effects/ignore-def.yml:4 @ 27c1e9c2` was not read either.
**Fix:** `docs/superpowers/specs/2026-10-17-kato-danzo-clauses.md @ dfcaa421` — the user asked for the quotations; Round 2 puts Yuugao's two readings with both sheets quoted, and the precedent is no longer offered as already decided.
