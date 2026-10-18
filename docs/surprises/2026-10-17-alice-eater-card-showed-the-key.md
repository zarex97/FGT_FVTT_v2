---
id: 2026-10-17-alice-eater-card-showed-the-key
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Alice Eater's card tells the player the Jabberwock's stay grew by 3◈.
**Actual:** Player1's card read *"Alice Eater Jabberwock Atk UpDurationDelta"*: the action's raw key, glued to the Atk Up row.
**Cause:** `module/engine/skill-use.mjs#applyPhaseEffects @ 7755ebb4`: the action-dispatch branch added for #247 pushed `summary: { name: kind }`, so the card printed the rule key.
**Fix:** `module/engine/skill-use.mjs#applyPhaseEffects @ 7755ebb4` names the stay before and after (`FGT.Skill.StayExtended`); re-pressed live: *"Stay on the board: 18 → 27 Turns left"*.
