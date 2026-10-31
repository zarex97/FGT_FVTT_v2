---
id: 2026-10-31-crit-chance-roll-off-card
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** GL.crit: the AU's Crit Chance −5% is visible where the Crit is decided.
**Actual:** No card prints the 1d100 against the Crit Chance; Glam Sight's −5 was seen only by probing `critChance` (45 vs 50).
**Cause:** `module/engine/attack.mjs:6363 @ 7b1e3c86` — the crit roll is made and never put on the card.
**Fix:** `module/rules/damage/pipeline.mjs` stage 2, `module/engine/attack.mjs` `ctx.crit.roll` @ a93cc681 — '1d100 = 61 vs 50% → no Crit', with the modifiers that moved it; pressed live.
