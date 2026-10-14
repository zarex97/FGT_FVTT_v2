---
id: 2026-10-13-glossary-merged-tick-and-diamond
found: user
kind: assumed-shape
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** the code misuses "tick": the glossary says a Tick (◈) is "the number of Turns in a Round", a length, so `tick` as the match's Turn counter was a second meaning. I proposed renaming it in 135 places and three saved fields.
**Actual:** the user: "◈ = Full Round (Numbers of turns in a round). Tick should be for turns, that basically are fractions of round." The code already agrees: `resolveTicks` returns a turn count and ◈ is `turnsPerRound`. Only the glossary merged the two words.
**Cause:** `CONTEXT.md:159 @ 832012d` — one entry, "**Tick** (**◈**)", named two terms. I took the glossary line as fact and did not check it against `module/domain/tick.mjs`, which says a ◈ expression resolves to "integer turn counts".
**Fix:** `CONTEXT.md:159 @ ebd3f2a` — split into **Tick** (one Turn as a length of time) and **◈** (one Round's worth of Ticks), and added **Moment**. No code rename.
