---
id: 2026-10-23-recommended-reactions-while-unable-to-act
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** my grill recommendation for Chiron's teaching (Q11): *"neither may Move, Attack or use a Skill or
NP; Evade and Block are allowed."*
**Actual:** the rules already say otherwise: *"Evading and Blocking are Acting"* (#232 reading 10), and
`cannotAct` forbids *"Move, Attack, use Skills or Noble Phantasms, Evade, Block or Counter."*
**Cause:** `packs/_source/effects/cannot-act.yml:4 @ 1ba28f15` — I recommended a reading of "cannot Act" without
grepping the term's ruling first; the Cannot Act status and #195 reading 12 had settled it.
**Fix:** the next grill round corrects the recommendation to reuse `cannotAct` as ruled. No code changed.
