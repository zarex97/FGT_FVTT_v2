---
id: 2026-10-17-jabberwock-knocked-heracles-sideways
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: false
---
**Expected:** Ruled (#247 reading 10): a Unit on the panel the Jabberwock moves onto is knocked 1 panel straight away from it.
**Actual:** Player1 moved the Jabberwock right, (9,11) to Heracles on (9,12). Heracles landed on (8,12): up, at a right angle to its travel.
**Cause:** `module/rules/movement.mjs#knockbackPlan @ eebbb988`: the default push fans out from the mover's centre, and a 1x1 mover's centre is the occupant's own panel, so the first free of up, down, left, right wins. `packs/_source/summons/jabberwock.yml @ eebbb988` named no direction and took Bašmu's.
**Fix:** `packs/_source/summons/jabberwock.yml @ uncommitted` carries Kingprotea's `Knockback` with `direction: arrival`; `nursery-247-rulings.test.mjs` plans the push on along its travel.
