---
id: 2026-10-28-applier-return-pinned-by-scan
found: test
kind: source-scan-pins-text
status: fixed
reviewed: true
pattern: source-scan-pins-text
---
**Expected:** Adding a field to `applyEffect`'s applied return changes no test.
**Actual:** `jack.test.mjs` failed: it matches the literal `return { outcome: "applied", reason: null, chance: rolled, intents, trace };`.
**Cause:** `test/unit/jack.test.mjs:365 @ a17cfa57` — a source scan pins the line's text.
**Fix:** `module/engine/effect-applier.mjs:472 @ a17cfa57` — the sibling count rides the trace (`step: "siblings"`), the return line kept.
