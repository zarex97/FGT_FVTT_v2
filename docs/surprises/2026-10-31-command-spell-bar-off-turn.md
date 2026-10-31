---
id: 2026-10-31-command-spell-bar-off-turn
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Ruling 6: her Master's Shisarot Form Command Spell is offered in her side's Turn only; the bar's dialog says 'Spend a Command Spell in your own Turn.'
**Actual:** On Faction 2's Turn (tick 3) Player1's Master bar was lit, offered Shisarot Form and spent it.
**Cause:** `module/rules/command-spells.mjs:111 @ 7b1e3c86` — `canSpend` never compared the `ownTurn` window with whose Turn it is, and `rules/actions.mjs` lit the button any time.
**Fix:** `module/rules/command-spells.mjs:115` and `module/rules/actions.mjs:175 @ uncommitted` — refused `notOwnTurn` (said on the bar), button not offered; pressed live at tick 7: 'A Command Spell is spent from the bar in its Master's own Turn.'
