---
id: 2026-10-31-arrival-knockback-silent
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** SF.8: a Unit on a panel she Moves into, or grows into, is knocked back, with a line a player sees.
**Actual:** Her Move onto Kingprotea's panel (tick 4) and her growth (tick 3) moved Units with no card and no log.
**Cause:** `module/engine/movement-hooks.mjs:622 @ 7b1e3c86` — the `arrival` push and the growth's `displacePlan` post nothing; Kingprotea's Huge Scale and Fafnir share it.
**Fix:** `module/engine/movement-hooks.mjs` `displacePlan(plan, { by })` @ uncommitted — the arrival push and the growth say who pushed whom; pressed live: 'Caster is knocked back 1 panel by Pretender.' on her growth and on her Move.
