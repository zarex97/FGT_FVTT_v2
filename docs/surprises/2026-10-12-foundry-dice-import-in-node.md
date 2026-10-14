---
id: 2026-10-12-foundry-dice-import-in-node
found: test
kind: assumed-shape
status: open
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** Foundry's `client/` layer does not import in Node, so tests cannot use the real `Roll`; the review planned a seeded fake.
**Actual:** a probe imported `client/dice/_module.mjs` and evaluated `5d10 + 3`, `2d6+3` and `floor(1d20/2)` with the real `Roll`, faces set through `CONFIG.Dice.randomUniform`. It needed two things: `@common/` resolved to `app/common/`, and `grammar.pegjs` compiled by the `peggy` the Foundry copy already ships.
**Cause:** `tools/lib/foundry.mjs:10 @ 832012d` and `docs/adr/0006-tests-and-build-run-real-foundry.md:33 @ 832012d` state the whole client layer as unimportable; the dice subtree imports no DOM or PIXI.
**Fix:** open. Candidate 1 of Wave A loads the real dice in tests; ADR-0006's consequence and the loader's header are amended when it lands.
