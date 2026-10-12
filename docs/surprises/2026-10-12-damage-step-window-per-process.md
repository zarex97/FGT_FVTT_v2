---
id: 2026-10-12-damage-step-window-per-process
found: live press
kind: siblings-race-at-shared-step
status: fixed
reviewed: true
pattern: check-then-act-race
---
**Expected:** one "Start of the Damage Step" for Airavata's three Processes (#188 reading 13: one answer for the attack).
**Actual:** three dialogs at once; Monstrous Strength taken in one reached one target.
**Cause:** `module/engine/attack.mjs:6290 @ 08ea4b1` — the group answer is read off a sibling's recorded pick, and the Processes reach the window before any has recorded one.
**Fix:** `module/engine/attack.mjs:6318 @ 98f05ca` — the first asks, its siblings await that answer.
