---
id: 2026-11-14-dice-registry-never-existed
found: tooling
kind: claim-without-reading-the-path
status: open
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** `docs/C-dice-registry.md` says *"Every roll in the system goes through `DiceRegistry.roll()`. Inline formula strings are forbidden by lint, so no roll can escape the registry"*. The Godot port's plan took "one dice door" as a port of that door.
**Actual:** No `DiceRegistry` exists under `module/`, `tools/` or `test/`. `module/` holds 92 inline `new Roll(` calls. The guard that does exist is narrower: `test/unit/dice-through-roll.test.mjs` refuses `Math.random`, not inline formulas.
**Cause:** `docs/C-dice-registry.md:207 @ 624eccf2` describes a plan-era registry that was never built, and no check reads the claim against the code.
**Fix:** Open, tracked in #409. The appendix's paragraph needs correcting to the guard that exists. For the port, the single dice door is new work (`grail-tact-godot/docs/plan/11-dice.md`), not a port.
