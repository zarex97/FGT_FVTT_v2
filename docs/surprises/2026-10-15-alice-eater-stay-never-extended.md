---
id: 2026-10-15-alice-eater-stay-never-extended
found: test
kind: producer-without-consumer
status: open
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** the corpus scan for id-less rule elements in `applyEffects` phases (written to find Castor's and Anastasia's) would find those two.
**Actual:** it found a third: Jabberwock's Alice Eater, `{ key: DurationDelta, ticks: "3◈" }`, *"extends its period of existing on the board for 3◈ more Turns"*. Cast on a summon with `expiresAt: 40`, its Atk Up landed and `expiresAt` stayed 40.
**Cause:** `module/rules/effect-flow.mjs:440 @ 7231295` — the same drop as `2026-10-15-mana-burst-cut-landed-nowhere`; here there is no existing phase kind to author the extension as (`DurationDelta` is a handler action only, `scheduler.mjs:1168`).
**Fix:** open. `tools/lib/content.mjs:1643 @ 67e91e1` names it in `PHASE_ACTIONS_STILL_DROPPED` so the build refuses every other such entry; the extension needs a phase kind of its own (a `duration` phase emitting `I.durationDelta`).
