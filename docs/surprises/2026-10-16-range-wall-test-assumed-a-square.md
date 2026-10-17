---
id: 2026-10-16-range-wall-test-assumed-a-square
found: test
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** a 5x5 centred two panels from Arjuna lies wholly inside Range 4, and one centred four away keeps 15
panels behind the wall.
**Actual:** `expected 23 to be 25` and `expected 13 to be 15`.
**Cause:** `test/unit/arjuna-234.test.mjs @ 5ecdefeb` — the test counted Range as a Chebyshev square; the attack
Range rule clips its outer corners (`domain/geometry.mjs#inAttackRange`), and the wall measures as the anchor does
(reading 17).
**Fix:** `test/unit/arjuna-234.test.mjs @ 5ecdefeb` — the far placement asserts every kept panel is in Range by
the Range rule itself; the near one is placed where all 25 are.
