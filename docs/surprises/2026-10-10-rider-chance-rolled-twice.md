---
id: 2026-10-10-rider-chance-rolled-twice
found: live press
kind: one-chance-two-dice
status: fixed
reviewed: false
---
**Expected:** Nemo's Normal Attack inflicts Slow on a 10% die; the card's "1d100 → 1 against 10%: hit"
means Karna is Slowed.

**Actual:** the card read "hit" and Karna carried no Slow. No effect line, no refusal.

**Cause:** `module/engine/scheduler.mjs:1180 @ 08ea4b1` — an `OnEvent` action's `chance` is gated by
`dispatch` on the die the card files, and copied onto the effect instance as well, where
`module/engine/applier.mjs:386 @ 08ea4b1` rolls a fresh d100 against it. Every action-level rider chance
in the corpus has been rolled twice: 10% landed 1% of the time.

**Fix:** `module/engine/scheduler.mjs @ d162f50` — the gated die travels as `effect.rolled` and the
applier reads it; the dispatch gate leaves an `ApplyEffect`'s verdict to the application, so resistance
and inflict bonuses still act on that one die.
