---
id: 2026-10-10-skill-debuff-reads-bare-caster
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** Atlas on Medusa rolls against 80%: 100, plus Item Construction's 50, minus 25 for MAG B, minus 25 for Magic Resistance B, minus her own Magic Resistance 20. `test/unit/skill-path-resistance.test.mjs` already asserted the +50.
**Actual:** "rolled 52 vs 30%", resisted. The +50 was missing.
**Cause:** `module/engine/skill-use.mjs:1317 @ 27c8858` handed `skillEffectContext` a bare `unitSnapshot(actor)`, which has no auras. Item Construction is an aura Medea holds on herself. `module/engine/applier.mjs:389 @ 27c8858` did the same for the event path. The test built its caster from the board, so it agreed with the code and not with the live call.
**Fix:** `module/engine/skill-use.mjs:1322 @ 40e21e7` and `module/engine/applier.mjs:393 @ 40e21e7` — both take the board's unit. `test/unit/medea-193.test.mjs` guards both call sites. The chance line now names the ability's own modifiers too.
