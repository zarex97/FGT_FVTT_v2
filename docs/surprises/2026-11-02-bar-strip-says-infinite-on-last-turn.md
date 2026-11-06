---
id: 2026-11-02-bar-strip-says-infinite-on-last-turn
found: live press
kind: unknown-value-falls-to-default
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** The action bar's effect strip gives each effect the time it has left, and *"∞"* only to an effect with no clock (#364 Nocturne, `barEffects`).
**Actual:** Pressed as Player1 with six Mermaid Tokens on Kiara (#372): the strip read *"Mermaid Token · ∞"* for the one Token whose clock ran out that Turn (expiry 8 at tick 8), beside *"⅓◈"* and *"⅔◈"* for the others.
**Cause:** `module/apps/hud/action-bar.mjs:92 @ 51de6a3f` — `turns ? ticksLabel(...) : "∞"`. `remainingTurns` answers 0 for a clock ending this Turn and `null` for none, and the truthiness test sent both to the no-clock branch.
**Fix:** `module/apps/hud/action-bar.mjs:94 @ 8b054f63` — `null` is ∞, 0 is *"ends this Turn"* (`FGT.HUD.EndsThisTurn`). Read live after the fix: *"Mermaid Token · ends this Turn"*.
