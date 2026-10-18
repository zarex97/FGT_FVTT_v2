---
id: 2026-10-17-glass-game-clock-read-by-nothing
found: retraction
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** The Glass Game's effect 1 fires at the Turn end 3◈ after an enemy came within 3 of Nursery, only with an enemy still there, and resets at a Round's end with none.
**Actual:** Read for the Clause list: its `Script` handler ran `rewindScript` at every Turn end she heard, rewinding every Unit within 3 of her by 3◈ each Turn of hers. The params carrying the condition (`afterTicks`, `requiresEnemyInRing`, `resetWhenRingEmpty`) are read by nothing, and `rules/glass-game.mjs#glassGameClock` is tested and never called.
**Cause:** `module/engine/glass-game.mjs#rewindScript @ eebbb988` takes no clock; the clock was built as a pure rule with no consumer.
**Fix:** `module/engine/glass-game.mjs#glassGameScript @ uncommitted`, heard at `anyTurnEnd` and `roundEnd`, keeps `glassGameClock` on her actor; `nursery-247-rulings.test.mjs` counts, fires at nine, resets.
