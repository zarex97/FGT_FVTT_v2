---
id: 2026-10-16-string-rank-passed-the-threshold-test
found: test
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** a MAG B attack against Magic Resistance A is negated, and my Anti-Dragon test (MR C against B, cut 25%) proved the weaker threshold.
**Actual:** the plain case read "−50% MAG (MR A < attack B)". The Anti-Dragon case had passed for the wrong reason.
**Cause:** `test/unit/arturia-230.test.mjs:46 @ 9d0ab57` — the test's attacker carried `parameters.mag: "B"`, a string; `Rank.compare` reads `.ordinal`, so every comparison came out NaN and every threshold read as "below". The board projects a Rank.
**Fix:** `test/unit/arturia-230.test.mjs:46 @ 9d0ab57` — the attacker carries `Rank.parse("B")`, and the plain case is asserted beside the weakened one so the comparison itself is proved.
