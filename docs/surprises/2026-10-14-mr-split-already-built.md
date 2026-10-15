---
id: 2026-10-14-mr-split-already-built
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** I told the user (#206 reading 10) that today the whole of Brahmastra Kundala's damage counts as MAG for Magic Resistance, and recommended keeping it.
**Actual:** The pipeline already meets Magic Resistance with the MAG share alone: against Rank A the hit is 920 (379 MAG + 541 STR), not 650, and a Rank that negates leaves the 541.
**Cause:** `module/rules/damage/pipeline.mjs:358 @ 7333e08` — stage 1 keeps each source's component, stage 3 splits the +100 in their ratio and stage 11 reads `s.mag` only; I read the YAML's `component: mag` comment, not the stage.
**Fix:** `test/unit/karna-206-rulings.test.mjs @ 95b91ea` — the ruling (the MAG share only) is what the code does; two tests pin it. No engine change.
