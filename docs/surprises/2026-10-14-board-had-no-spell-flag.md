---
id: 2026-10-14-board-had-no-spell-flag
found: test
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** Refusing Spells in `canCopy` needed only the test Silence already uses: `isSpell`, or the `spell` category.
**Actual:** `copyCandidates` reads the board's ability snapshots, which carried `category` but not `isSpell`, so Aero and Rain of Light, flagged only by `isSpell`, would still have been offered.
**Cause:** `module/rules/snapshot.mjs:2040 @ 4983091` — the board projection copies the fields `canCopy` asked about when it was written, and `isSpell` was not one.
**Fix:** `module/rules/snapshot.mjs:2051 @ cde0483` — the projection carries `isSpell`, and `rules/costs.mjs#isSpellAbility` is the one reader.
