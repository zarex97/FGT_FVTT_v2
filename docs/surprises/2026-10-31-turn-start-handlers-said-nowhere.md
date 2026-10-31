---
id: 2026-10-31-turn-start-handlers-said-nowhere
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Ruling 36: Ocean Stirring fires at her Turn's start by itself, 'with its line on the card'.
**Actual:** At tick 6 her NP went 0 → 24, three buffs landed and the Form grew 12 → 15; the log had 'event … Ocean Stirring', the chat nothing.
**Cause:** `module/engine/scheduler-hooks.mjs:399 @ 7b1e3c86` — `beginTurn`'s intents ran with no report; only fields' turn-start events had a card.
**Fix:** `module/engine/scheduler-hooks.mjs:401-419 @ fd0d2bbe` — a 'Start of the Turn' card as the Turn's end has; pressed live at tick 8. Still open: the Form's +1◈ (ExtendEffect) is not on it.
