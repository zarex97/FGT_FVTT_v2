---
id: 2026-10-17-glass-game-rewound-nothing-live
found: live press
kind: passes-for-the-wrong-reason
status: fixed
reviewed: true
pattern: passes-for-the-wrong-reason
---
**Expected:** The Glass Game's effect 1, firing at a Turn's end, returns every Unit within 3 of her (not her) to how it stood 3◈ before.
**Actual:** It fired at tick 31 (`glassGameRewind` logged, the clock back to 0) and Arturia kept her staged 900 Health and her Def Dwn; Van Gogh's Health did not move. No card said anything had happened.
**Cause:** `module/engine/scheduler-hooks.mjs @ eebbb988` built the Turn's-end and Round's-end contexts with no `history`, and `attack.mjs`'s defeat context had none either, so `ctx.history ?? {}` was always empty and `stateAt` found nothing. Every glass-game test hands `history` to the script directly, so all of them passed on a path the board never takes.
**Fix:** `module/engine/scheduler-hooks.mjs`, `module/engine/attack.mjs @ 7755ebb4` pass `historyOf(combat)`; `nursery-247-rulings.test.mjs` pins it in all three contexts; `glass-game.mjs#postGlassGame` says whom it turned back.
