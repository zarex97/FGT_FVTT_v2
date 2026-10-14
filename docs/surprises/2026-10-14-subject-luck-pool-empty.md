---
id: 2026-10-14-subject-luck-pool-empty
found: test
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** A test subject Heracles has Luck to spend, from LUC A.
**Actual:** `luck.max` 0: a stored `luck.value: 3` written by the test was clamped to 0 by the first spend. The pool is rolled at war setup, which a subject never went through.
**Cause:** `module/engine/war-setup.mjs:250 @ a436802` — Luck is set at setup, not derived from the rank.
**Fix:** `test/unit/prevention-luck-check.test.mjs:41 @ 1f1b099` — the test sets both `max` and `value`.
