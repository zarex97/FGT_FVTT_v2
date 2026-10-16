---
id: 2026-10-16-phase-targeting-hid-a-concealed-ally
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Hassan 5's Librarian of Stored Knowledge offers Passive 2's pick of every other body within 2, Hassan 7 (concealed, 1 panel away) included.
**Actual:** the pick offered Hassan 6 alone.
**Cause:** `module/engine/skill-use.mjs:354 @ uncommitted` — a phase's own targeting was resolved with no `limits.forAttack`, which `rules/targeting/resolve.mjs` reads as an Attack, so a concealed ally was refused as for an enemy. The Skill's own targeting says `forAttack: false` (`rules/ability-use.mjs#targetSpecFor`); the phase's did not.
**Fix:** `module/engine/skill-use.mjs:354 @ uncommitted` — a phase's targeting is resolved with `forAttack: false`.
