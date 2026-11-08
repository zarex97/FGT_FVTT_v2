---
id: 2026-11-08-batch-lines-and-intents-said-twice
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Fig Tree's card says each ally's heal once, copying `round-phase.mjs`'s `postTurnEndReport(intents, null, null, title, out.lines)`.
**Actual:** *"Master of Archer of Faction 1 regains 50 Health (Fig Tree of Tranquility). … Master of Archer of Faction 1: Master of Archer of Faction 1 regains 50 Health (Fig Tree of Tranquility)."*
**Cause:** `module/engine/turn-report.mjs:189 @ dda17e6`: `turnEndCard` says a heal off the intents, and the applier's `lines: true` says it again (`healLines`). The same goes for a pool (`resourceLines`). The precedent in `round-phase.mjs` passes both.
**Fix:** `module/engine/io.mjs:1959 @ 5e770cb`: the heal and resource intents are filtered out, and the batch's lines say them, clamped. The same filter is in `module/engine/round-phase.mjs:76 @ 5e770cb`.
