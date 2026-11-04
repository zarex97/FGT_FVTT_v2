---
id: 2026-11-04-grill-said-tokens-restore-what-they-took
found: live press
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** Gilgamesh's Q23 said that when Enuma Elish removes Nameless Forest's Tokens, *"Max Health, Base Attack and Max Luck recover as the Tokens go. Current Health and Luck stay lost, as on a Luck Check."* The user ruled it as recommended.
**Actual:** Live, Proto Gil stayed at 975/975 with his Token gone. A Luck Check writes no stat back, and neither does anything else: `nameless-forest.yml` pays each loss once, *"Not a `MaxDelta` scaled by the held count"*, because of the sheet's *"(Health and Luck that are lost from the effects of this NP are not restored)"* (#247 reading 5). The press also found the Token pool left at its count, since `removesEffects` took only the marker.
**Cause:** `docs/superpowers/specs/2026-11-02-gilgamesh-clauses.md:132 @ cf8afdb0` — the Q23 pick quoted Nursery's sentence and never read the effect file or `engine/nameless-forest.mjs:90 @ cf8afdb0`, which says *"NOTHING ELSE -- no stat is written back."*
**Fix:** `module/engine/attack.mjs @ uncommitted` — the row's `clearsResources` takes the pool. Built as a Luck Check takes them, no stat written back. The user ruled on the false sentence, so it went back to them, and they ruled the same on 2026-11-04: nothing comes back, and no 10% resistance is earned.
