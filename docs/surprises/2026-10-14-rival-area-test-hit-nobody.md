---
id: 2026-10-14-rival-area-test-hit-nobody
found: test
kind: passes-for-the-wrong-reason
status: fixed
reviewed: true
pattern: passes-for-the-wrong-reason
---
**Expected:** `karna-206-rulings.test.mjs`'s "refuses one that does not" shows an area Attack over Heracles alone refused by Fated Rivals, "with its reason", as its comment says.
**Actual:** asserting the reason failed: "expected 'No legal targets in the selected area.'". The 5x5 on (2,3) never reached Heracles at (5,4), so the area was empty and refused for that.
**Cause:** `test/unit/karna-206-rulings.test.mjs:286 @ 95b91ea` — the test asserted `units` was empty, which an empty area satisfies as well as a rival-less one.
**Fix:** `test/unit/karna-206-rulings.test.mjs:286 @ 95b91ea` — anchored on (5,2), over Heracles and not Arjuna, and asserts "Heracles is in an area without the rival this attacker is bound to".
