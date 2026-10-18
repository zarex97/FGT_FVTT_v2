---
id: 2026-10-17-forest-losses-landed-past-the-resistance
found: retraction
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** *"The chance of it gaining Nameless Forest Tokens again is reduced by 10%"*: a Unit that resists is not caught, and loses nothing.
**Actual:** Read for the Clause list: the forest's six actions are dispatched one by one. The resistance gates the `ApplyEffect` of the marker only; the Token and the four Max Health, Base Attack and Max Luck losses land regardless, on a Unit then holding no marker, so no escape check and no death roll.
**Cause:** `packs/_source/abilities/nursery-nameless-forest.yml @ eebbb988`: one landing split into six actions, and the one chance consumed by one of them.
**Fix:** `packs/_source/effects/nameless-forest.yml @ uncommitted`: the Token and the losses are the marker's `onApply`, paid on every landing (`onApplyEachLanding`, `engine/landing.mjs`), so the one chance gates all of it.
