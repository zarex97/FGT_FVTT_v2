---
id: 2026-10-15-handler-until-event-dropped
found: test
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** a handler's `ApplyEffect` with `duration: "until roundEnd"` lasts to the Round's end, as a phase's
`applyEffects` with the same string does (Mannanán's Tradition Carrier, Watermelon's Blind).

**Actual:** the effect was permanent. The action resolved the duration to `INFINITE` and kept only `expiry`; the intent
carried no `duration`, `entryOfIntent` forwarded none, and the landing flow computed `endsOn` from a duration it never
saw.

**Cause:** `module/engine/scheduler.mjs:1219 @ 1f1a549` (`ticks` only) and `module/engine/applier.mjs:378 @ 1f1a549`
(`entryOfIntent` copies no duration). Nothing authored a handler `until` before the Circuits, so nothing had read it.

**Fix:** `module/engine/scheduler.mjs:1226 @ 22a42ca` stamps `duration` for an `until <event>`;
`module/engine/applier.mjs:390 @ 22a42ca` forwards that one form, so the flow records `endsOn`.
