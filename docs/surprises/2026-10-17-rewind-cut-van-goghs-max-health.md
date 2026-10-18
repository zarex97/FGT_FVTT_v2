---
id: 2026-10-17-rewind-cut-van-goghs-max-health
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** A rewind returns each Unit's Health to what it was, its maximum included.
**Actual:** The Glass Game, working at last, wrote Van Gogh from 599/1250 to *299/299*: his recorded state at tick 24 read `{value: 299, max: 299}`.
**Cause:** `module/rules/history.mjs#pool @ eebbb988` turned a flattened number into `{value: n, max: n}`; the board projects Health, Agility and Luck as their value with the maximum beside it (`maxHealth`, `maxAgility`, and no `maxLuck` at all). Every record after the first full one carried max = value.
**Fix:** `module/rules/history.mjs#snapshotUnit @ uncommitted` reads each maximum from the projection; `module/rules/snapshot.mjs @ uncommitted` projects `maxLuck`. Van Gogh's 1250 restored by hand in the audit world.
