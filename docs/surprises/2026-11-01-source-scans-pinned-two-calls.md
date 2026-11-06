---
id: 2026-11-01-source-scans-pinned-two-calls
found: test
kind: source-scan-pins-text
status: fixed
reviewed: true
pattern: source-scan-pins-text
---
**Expected:** Adding an argument to the bar's `afford(...)` and a clause to `defenderFields`'s reaction offer would change no test.
**Actual:** `test/unit/emiya-208-live.test.mjs` and `test/unit/achilles.test.mjs` failed: both scan the source for the exact call text.
**Cause:** `module/apps/hud/action-bar.mjs` and `module/engine/attack.mjs#defenderFields @ d6ae552e`: I changed two call texts without grepping `test/` first, as the Lesson says.
**Fix:** Both patterns widened to admit the new argument, never lowered (`test/unit/emiya-208-live.test.mjs:34`, `test/unit/achilles.test.mjs:853 @ d6ae552e`).
