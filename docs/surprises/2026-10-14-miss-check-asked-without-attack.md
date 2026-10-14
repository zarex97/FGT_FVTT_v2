---
id: 2026-10-14-miss-check-asked-without-attack
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Blind Anastasia does not miss at Range 1 to 2 (Watermelon Splitting Master).
**Actual:** With every die on 1 she missed at Range 1: the Process went to `missed`.
**Cause:** `module/engine/attack.mjs:6292 @ 1036806` — `runMissCheck` asked `missChance` with `rollOptionsFor({ attacker, board })`: no defender, no attack, no range for the `Suppress` to read.
**Fix:** `module/engine/attack.mjs:6299 @ a45b0bd` — asked through the Attack Description; `anastasia-miss.test.mjs`.
