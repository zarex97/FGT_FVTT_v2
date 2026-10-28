---
id: 2026-10-28-war-start-asks-no-opening-choice
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** Rama's summon owed two Vishnu Bhuja picks (Heads, 6 and 6), so his player would be asked them when the War began.
**Actual:** No question came. `openingChoices.due` stayed `[]` after `startCombat()`; the custom War's tokens were placed by hand after `commitWar`.
**Cause:** `module/engine/war-setup.mjs:470 @ 02fe93eb` — `commitWar` marks opening choices once, over the board it deployed, and a custom War deploys nobody; `module/engine/opening-choice.mjs:274 @ 02fe93eb` — the `createToken` hook waits for a started War, so a token placed before the start is never asked.
**Fix:** `module/engine/opening-choice.mjs:282 @ uncommitted` — the War's start (`combatStart`) marks and asks every opening choice still owed. Test: `rama-347.test.mjs` "a War's start marks the pick a 6 owes".
