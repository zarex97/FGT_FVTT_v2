---
id: 2026-10-10-attack-skill-lit-after-attacking
found: live press
kind: gate-and-display-disagree
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** after Nemo's Riding Attack, every Attack of his greys on the bar with "this unit has already
attacked this turn", as the Attack slot did.

**Actual:** Triton's Conch stayed lit. Its targeting opened, listed two targets, offered "Attack", and the
declaration was refused: "FGT | Cannot attack: this unit has already attacked this turn".

**Cause:** `module/apps/hud/action-bar.mjs:166 @ 08ea4b1` consults `budget.affordable` for the actions row
only; an ability that is an Attack asked `canUseAbility`, which knows nothing of the Turn's budget. The
shape §46.3 names "the gate and the display disagree".

**Fix:** `module/apps/hud/action-bar.mjs:266 @ d162f50` — an Attack ability asks the same
`afford("attack")` and is disabled with its sentence.
