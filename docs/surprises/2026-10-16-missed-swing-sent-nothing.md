---
id: 2026-10-16-missed-swing-sent-nothing
found: live press
kind: unknown-value-falls-to-default
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** Karna under Drowning swings at Proto Gil, the 80% miss lands, and the card says she missed (#232
reading 19), as a Blind miss has said since step 1.5 was built.
**Actual:** the declaration threw *"Illegal Combat Process transition "missed:nothing". Legal events from "missed":
done."* and the Process sat at `missed`, its Combat Phase never ended.
**Cause:** `module/engine/attack.mjs:1279 @ 2e097ec` — the guard that answers a rung nobody can answer (Kiritsugu,
§46.4) sends `nothing` to any Process with no pending prompt, and a missed one has none; it was written after Blind's
miss, and no test declared an Attack that missed.
**Fix:** `module/engine/attack.mjs:1279 @ 2e097ec` — a missed Process is closed with `done`; the guard answers only
an unanswerable rung. `proto-gil-232-arena.test.mjs` declares a missing Enkidu.
