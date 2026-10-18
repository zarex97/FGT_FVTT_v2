---
id: 2026-10-17-default-swallowed-the-undefined-target
found: test
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** `pressGate(actor, item, { target: undefined })` would judge only the requirements the Unit can
answer alone, the mode a billed window use (Monstrous Strength) is offered in, before anyone is aimed at.
**Actual:** The code review found it never switched on: `(({target = null}) => target === undefined)({target:
undefined})` is `false`. A target requirement refused for want of a target, and no test asked the mode.
**Cause:** `module/engine/press-gate.mjs#pressGate @ dd853c6f`: the destructuring default `target = null`
replaces an explicit `undefined`, so `selfOnly: target === undefined` read the default, not the caller.
**Fix:** `module/engine/press-gate.mjs#pressGate @ dd853c6f` takes `selfOnly` as its own flag, which
`attack.mjs#windowGateContext` passes for a billed use; `offer-gate-244.test.mjs` asks it both ways.
