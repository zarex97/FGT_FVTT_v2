---
id: 2026-10-22-cooldown-cut-ticks-unchecked-at-build
found: live press
kind: unknown-value-falls-to-default
status: fixed
reviewed: false
---
**Expected:** `npm run validate:content` refuses any `ticks` the engine cannot parse, so test content that builds clean presses clean.
**Actual:** Test Use: Cutter's `cooldown` phase change `ticks: "1"` built with 0 errors. Player1's press did nothing on the board; the relay answered *"FGT | Cannot parse duration "1". Expected a ◈ expression, "N turns", …"*.
**Cause:** `tools/lib/content.mjs:1937 @ b3da2d09` — `durationFields` collects `duration` and `cooldown`, never a `cooldown` phase's `changes[].ticks` nor a `CooldownDelta`'s `ticks`, which `engine/skill-use.mjs#cooldownChanges` reads through `parseTick`.
**Fix:** `tools/lib/content.mjs#durationFields @ uncommitted` — both are parsed at build; `cooldown-cut-bonus.test.mjs` "the build parses a cooldown phase's cut" refuses a bare "1". The content says "1 turns".
