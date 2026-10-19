---
id: 2026-10-18-tracker-inferred-the-wrong-war
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** with every reader asking `currentWar()`, each scene's viewers see that scene's War in the combat tracker too.
**Actual:** on "Great Holy Grail War" the GM's tracker showed `aRHzNDQHp68Hhs52`, a stray empty global combat, while the turn panel and the rules read War `2SYtb3A7ObpJ92mI`.
**Cause:** `module/apps/combat/tracker.mjs:27 @ b6239686` — Foundry's tracker answers "which combat" itself (`CombatTracker#inferCombat`: the active combat, else one on the globally activated scene), a reader of the same question the engine now asks `currentWar()`.
**Fix:** `module/apps/combat/tracker.mjs:38 @ uncommitted` — the tracker's inference asks `currentWar()` and re-renders on `canvasReady`. Live: the tracker showed War A on A's scene and War B on B's.
