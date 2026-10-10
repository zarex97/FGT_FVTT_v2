---
id: 2026-10-10-dimension-exit-offer-unheard
found: retraction
kind: event-with-no-listener
status: fixed
reviewed: false
---
**Expected:** the Storm Border surfaces at a Turn End, by Nemo's choice or forced at 2◈ — the design and
`nemo.test.mjs` both treated the resurface as built.

**Actual:** reading the code for the #191 audit, `runDimensionClock` only raised
`fgtDimensionExitOffer`, and `grep` found no `Hooks.on` for it anywhere. Nothing ever surfaced.

**Cause:** `module/engine/dimension.mjs:417 @ 08ea4b1` — the boundary handed the decision to a placement
layer through a hook, and that layer was never written. The unit tests covered the pure half only.

**Fix:** `module/engine/dimension.mjs:807 @ d162f50` — the clock carries out a plan pressed on Nemo's
Resurface control, or surfaces on his panel at the ceiling; nothing waits on a listener.
