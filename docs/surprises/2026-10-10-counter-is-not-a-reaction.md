---
id: 2026-10-10-counter-is-not-a-reaction
found: retraction
kind: event-option-never-emitted
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Quickfire refunds 1◈ of its cooldown only if the target does not Counter
(`predicate: ["not:target:reaction:counter"]`).

**Actual:** tracing the after-Process step for the Counter press: `target:reaction:<x>` is built from
`state.reaction`, the react rung (nothing, Block, Evade). A Counter is declared at the `counter` rung and
never changes `state.reaction`, so the option never appears and the refund pays after a Counter as well.
The live Counter could not be pressed in time over CDP (the prompt's timer), so this was found by reading.

**Cause:** `module/engine/attack.mjs:1631 @ 08ea4b1` — `runAfterProcessPhases` read only `rollOptions`.

**Fix:** `module/engine/attack.mjs @ d162f50` — the option is added when the history holds the
`counter` rung's `counter` event.
