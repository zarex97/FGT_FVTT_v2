---
id: 2026-10-17-invuln-never-met-an-np
found: test
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** Invuln cuts an NP by 50% (Appendix A), so Penetration's *"halves the effect of Invuln"* would only need
to halve that cut (#243 reading 11).
**Actual:** Probed through `computeDamage`: 300 in, Invuln on the defender, a Normal Attack 0, an NP **300**. No
stage read Invuln against an NP.
**Cause:** `module/rules/damage/pipeline.mjs:1193 @ a27e058f` said *"The NP halving already happened at stage 15"*
and skipped the NP; stage 15 has no Invuln reader, nor does any other file. Ch. 22 repeated the comment.
**Fix:** `module/rules/damage/pipeline.mjs:1198 @ 5101f86f` cuts an NP by 50%, by 25% under Penetration;
`kiritsugu-243-rulings.test.mjs` asserts 150 and 225.
