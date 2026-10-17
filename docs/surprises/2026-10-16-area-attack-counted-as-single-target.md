---
id: 2026-10-16-area-attack-counted-as-single-target
found: test
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** Bab-ilu's passive answers only a single-target Attack (#232 reading 1), so its own 3x3 Active,
catching one DU, offers no additional Normal Attack.
**Actual:** the arena test failed with *"A question nobody scripted was shown to u1: "FGT.FollowUp.Title""*:
the 3x3 over a lone Asterios offered the second swing.
**Cause:** `module/engine/follow-up.mjs:76 @ 2e097ec` — "single target" was read as "the Processes name one
defender", which an area Attack that catches one Unit also satisfies.
**Fix:** `module/engine/follow-up.mjs:80 @ 2e097ec` — the ability's own targeting shape decides: any shape
but `unit` is an area Attack, however many it caught.
