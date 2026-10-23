---
id: 2026-10-23-unknown-phase-kind-built-clean
found: test
kind: unknown-value-falls-to-default
status: fixed
reviewed: false
---
**Expected:** `npm run validate:content` refuses a phase kind no executor runs, as it refuses an unknown element
key, ability kind or timing window.
**Actual:** Chiron's `teach` phase, authored before its executor, built with 0 errors; a Skill's executor would have
warned in the console and done nothing.
**Cause:** `tools/lib/content.mjs:1315 @ 706f5fde`: `validateDocument` checked kinds, windows and element keys, never
`phases[].kind` against `PHASE_IDS`; nor a `removeEffect` selector's keys, so a typo'd `valance` matched every buff.
**Fix:** `tools/lib/content.mjs#phaseKindsAreKnown @ 28e231ce`, at every nesting a phase list sits in, with the
selector keys `rules/removal.mjs#selectorMatches` reads. `content.test.mjs` red first.
