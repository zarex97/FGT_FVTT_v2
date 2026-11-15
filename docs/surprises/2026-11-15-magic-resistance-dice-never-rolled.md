---
id: 2026-11-15-magic-resistance-dice-never-rolled
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** The Normal Saber's Magic Resistance, *"All MAG damage taken is reduced by 5d20; if NP, double the number
of dice rolled"*, takes a 5d20 off a MAG attack's damage.
**Actual:** Pressed in the Godot port (War m2s4), which ports this engine: a Normal Caster's MAG Normal Attack on a
Saber read stage 11 "magicResistance 0 (dice mode (5d20) — never negates)", 145 -> 145, and no die was thrown.
**Cause:** `module/rules/damage/pipeline.mjs:1075 @ 3ff252f1` reads `ctx.rolls.magicResistanceDice` and
`module/engine/attack.mjs` (`applyDamage`'s rolls) never supplied it; only `rules/preview.mjs` and a golden test did.
The ZON penalty's defect (`test/unit/zon-penalty.test.mjs`), one stage later.
**Fix:** `module/engine/attack.mjs @ 1d3389d2` rolls it (`rollMagicResistance`) beside the negation dice, only for a
dice-mode resistance against an attack drawing on MAG, doubled against a Noble Phantasm when the resistance says so;
the preview's bounds are 5d20's; `test/unit/magic-resistance-dice.test.mjs` holds both. The Godot driver follows.
