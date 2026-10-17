---
id: 2026-10-17-terror-stun-met-resistance
found: live press
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** Terror: *"chance of being inflicted with Stun from Terror is 60%"*, which Appendix A says *"is not modified by debuff chance or resist effects"*.
**Actual:** At the end of Faction 2's Turn (Round 4, tick 11), the card: "Lancer: Stun: resisted, rolled 74 vs 45% · Archer: Stun (rolled 3 vs 45%) · Master of Lancer of Faction 2: Stun (rolled 35 vs 60%)": Karna's and Proto Gil's Magic Resistance took 15 off.
**Cause:** `packs/_source/effects/terror.yml:7 @ 8d1c012f` — the file reasoned that an action's chance meets "nothing between it and the roll"; since #191 the action's die is decided at the landing, against resistance and bonus. The authored flag for a flat chance (`bypassChanceModifiers`, Queen's Poison) was not on it.
**Fix:** `packs/_source/effects/terror.yml` @ uncommitted — the Stun action states `bypassChanceModifiers: true`.
