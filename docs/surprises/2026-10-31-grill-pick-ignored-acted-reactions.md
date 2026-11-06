---
id: 2026-10-31-grill-pick-ignored-acted-reactions
found: user
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** I recommended for Gray's #362 reading 6 that *"any Turns she Acts"* leave out Evade, Block and Counter. I said the Turn Record's `acted` is set by a Move, an Attack, a Skill or an NP only.
**Actual:** The user ruled that Evading, Blocking and Countering on an enemy Turn count as Acting. The engine already did so: #195 reading 12 ruled it for Raikou on 2026-10-10, and #194 built it.
**Cause:** `module/engine/attack.mjs:2231 @ 8b5fa12c` marks an Evade or a Block `acted` (`reaction:acted`), and `attack.mjs:5616` a Counter. I wrote the pick from the old #190 reading 6 and never read the writer of `acted`.
**Fix:** `docs/superpowers/specs/2026-10-31-gray-clauses.md` reading 6 @ e3b208db: rewritten to the ruling, citing the three writers. No code change: the engine already matches.
