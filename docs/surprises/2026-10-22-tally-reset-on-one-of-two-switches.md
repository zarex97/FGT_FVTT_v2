---
id: 2026-10-22-tally-reset-on-one-of-two-switches
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** a Mode switched back on starts its Tally from 0. Saitou's count is *"for the duration of that
activation"* (plan Task 9, L1-14). The bar should read "0/2".

**Actual:** pressed live as Player1. Test Count: Tally ended at "2 reached", and Player1 switched it on again from the
action bar. The slot read "2/2", and the stored `system.tally` was still 2. The next successful Attack would have
ended it at once.

**Cause:** `module/apps/actor-sheet/sheet.mjs:264 @ de01fece`. A Mode has two writers of its switch: the owner's press
(`FGTActorSheet.toggleMode`, which the action bar calls) and the engine's forced switch (`engine/io.mjs#setMode`). The
reset went into `io.setMode` alone, at `module/engine/io.mjs:567 @ de01fece`. The unit test switched the Mode through
`io.setMode`, so it passed.

**Fix:** `module/rules/modes.mjs:511 @ d0f24d3a`. `modeSwitchPatch` is the one patch a switch writes, the Tally reset included, and both writers call it. Test in `mode-tally.test.mjs` presses the owner's switch (`FGTActorSheet.toggleMode`).
