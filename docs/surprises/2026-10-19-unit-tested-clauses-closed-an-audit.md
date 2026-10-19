---
id: 2026-10-19-unit-tested-clauses-closed-an-audit
found: user
kind: live-client-only
status: fixed
reviewed: false
---
**Expected:** Yan Qing's audit could close with 71 Clauses pressed or observed and 4 "unit-tested" (DP.size, NP.dup, NP.1.agi, PC.1.tails), as Danzō's closed with one (#249 PC.7).
**Actual:** the user: "that's unacceptable, everything must be pressed or observed."
**Cause:** `docs/superpowers/specs/2026-10-19-yan-qing-clauses.md @ cce1f438` — I filed what the live board did not produce by chance (a duplicate die, a Tails, a large Unit, a survivor of the NP) as tested, instead of staging it.
**Fix:** the four were staged and pressed live on 2026-10-19 (a Bašmu on the board, a d4 queue 1, 1, 3, a d2 Tails, Medea's Health raised to outlive the NP); #253 reads 65 Pressed, 10 Observed. Memory `feedback-every-clause-pressed-or-observed`.
