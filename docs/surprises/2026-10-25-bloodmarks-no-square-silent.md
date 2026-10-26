---
id: 2026-10-25-bloodmarks-no-square-silent
found: user
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** The user: *"I can't see the region of Blood Temple"*. Four Bloodmarks were down, so Bloodfort Andromeda
should be up and drawn.
**Actual:** The marks stand at rows 0 and 7, columns 3 and 11: an 8x9, not a 5x5, 7x7 or 9x9. No field opened, which
is the rule, and nothing on the board said so.
**Cause:** `module/engine/marks.mjs:100 @ cc1d8e41` — `placeMark` returned `{ok: true, marks: 4}` with no line when
the marks completed no square.
**Fix:** `module/engine/marks.mjs:117 @ d3452f94` — four or more marks with no square whisper
`FGT.Bloodmark.NoSquare` to her owners and the GM. Not tested or pressed: no world test places marks yet.
