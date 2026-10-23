---
id: 2026-10-22-outcome-said-before-its-die
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** Gilles falls with the Spellbook whole: the card says the 10% die and its miss, then the Elder
Horrors the miss sends.
**Actual:** "5 of 5 Elder Horror appear around Caster." was posted first, then "Caster rolls 56 against 10% for
Prelati's Spellbook: Gigantic Horror: it does not happen."
**Cause:** `module/engine/applier.mjs:1187 @ d97795b9` — the log intent ran its side effects (`summonAround`,
`split`, `transform`) inside the loop before `io.log` posted the batch's lines, so a consequence was said before
the line that caused it.
**Fix:** `module/engine/applier.mjs:1197 @ 965a7cc5` — `io.log` posts the batch first, then the side effects
run; test "the missed die is said before the Elder Horrors it brings".
