---
id: 2026-10-22-gm-turn-claimed-missing
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** my Q12 recommendation in Gilles (Caster)'s grill: the Gigantic Horror acts *"in a GM's Turn
added as the Round's last Turn"*, as if the engine had no GM's Turn. Issue #293 says *"no Turn is the GM's"*.
**Actual:** the GM's Turn already exists. `CONTEXT.md` defines a Round as *"One Turn per Player, plus the GM's
Turn"*, and Ch. 25 says *"The GM always takes the last slot and does not roll."* It is counted in ◈. Only
its contents are missing: *"The GM combatant returns `null` for faction id… nothing happens on its turn."*
**Cause:** `module/engine/turn-order.mjs:58 @ d97795b9` — `factionOfCombatant` gives the GM slot no faction,
so it gets no budget. I took #293's line as fact and never read the turn order.
**Fix:** `docs/superpowers/specs/2026-10-22-gilles-caster-clauses.md @ 965a7cc5` — Round 2's reading 12a
puts the Gigantic Horror in the existing GM slot. It adds no Turn and leaves ◈ as it is.
