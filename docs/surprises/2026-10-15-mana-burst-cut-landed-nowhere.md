---
id: 2026-10-15-mana-burst-cut-landed-nowhere
found: test
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Castor's Mana Burst, *"Then, reduce Castor's NP Cooldown by 1◈ Turns"*, turns the Noble Phantasm's clock. The audit's plan read the authored `CooldownDelta` and predicted only that Pollux's copy would be missed.
**Actual:** the first arena press of Castor's Mana Burst left his NP at 18 before and after (`expected 18 to be 15`); neither copy moved. Anastasia's Shvibzik, authored the same way, left every NP at 18 (`expected [ 18, 18 ] to deeply equal [ 13, 13 ]`).
**Cause:** `module/rules/effect-flow.mjs:440 @ 7231295` — both abilities wrote the cut as `{ key: CooldownDelta, … }` in an `applyEffects` phase; that phase lands effects, every reader (`engine/skill-use.mjs:1107`, `engine/attack.mjs`) reads an entry through `entryOf`, and an entry with no effect id is `null`. The phase had a producer (the content) and no consumer, and its unit tests pinned the authored shape (`dioscuri.test.mjs`, `anastasia.test.mjs`), so nothing looked at the clock.
**Fix:** `packs/_source/abilities/dioscuri-mana-burst-castor.yml:91 @ uncommitted` and `anastasia-shvibzik.yml:27 @ uncommitted` — `cooldown` phases; `tools/lib/content.mjs @ uncommitted` refuses an id-less rule element in an `applyEffects` phase. `dioscuri-209-arena.test.mjs` fails on the old content.
