---
id: 2026-10-10-home-bases-are-zones
found: live press
kind: name-drift-across-a-boundary
status: fixed
reviewed: false
---
**Expected:** the Resurface picker never offers a 5x5 that overlaps an enemy Home Base (ruling R3).

**Actual:** from a submerge point at (14,10), `landingOptions` offered centres down to row 18 — inside
Faction 2's base (rows 18–20). The live board's `homeBases` was undefined.

**Cause:** `module/engine/dimension.mjs:181 @ 08ea4b1` read `board.homeBases`; the board carries Home
Bases as `zones`. `dimension.test.mjs` built its boards with `homeBases`, so the tests agreed with the code
and not with the board — §46.3's "name drift across a boundary".

**Fix:** `module/engine/dimension.mjs @ d162f50` — reads `zones` as well, whose side is `faction`, not `factionId` (a second drift found on the first live check of the fix); a test uses the live shape.
