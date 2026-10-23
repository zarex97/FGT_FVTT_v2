---
id: 2026-10-23-test-assumed-karnas-mov
found: test
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** my Gravity Manipulation test: Karna's MOV 5, so 2, 1 and 1 at three, two and one panels.
**Actual:** `at 3: expected 4 to be 2`. Karna's MOV is 7; the aura was right and the test was not.
**Cause:** `test/unit/olga-328.test.mjs:178 @ 7f02a2c2`: a subject's figure written from memory, not read off
`packs/_source/servants/karna.yml` first.
**Fix:** `test/unit/olga-328.test.mjs @ 7f02a2c2`: the cases read 7 − 3, 7 − 4, 7 − 5, and the floor has its
own test on `rules/auras.mjs#auraMov`.
