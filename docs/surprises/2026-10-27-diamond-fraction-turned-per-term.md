---
id: 2026-10-27-diamond-fraction-turned-per-term
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** X = 1◈ + ½◈ × d4 is 5, 6, 8 or 9 Turns at three Turns a Round.
**Actual:** I built it as 1◈ in Turns plus the roll times ½◈ in Turns, and ½◈ is two Turns by the table: 5, 7, 9, 11. Seen live on the card (*"lasts 5 Turns"*) and caught only by working the even rolls.
**Cause:** `module/engine/transform.mjs:118 @ 6ef9ce96` — each term turned into Turns before the sum; the sheet's bracket is a ◈ quantity.
**Fix:** `module/engine/transform.mjs:166 @ ab3d28a9` — `lastingTurns` sums in ◈ and turns the total once, the fraction left by the War's table.
