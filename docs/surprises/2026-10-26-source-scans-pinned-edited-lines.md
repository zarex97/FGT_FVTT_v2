---
id: 2026-10-26-source-scans-pinned-edited-lines
found: test
kind: source-scan-pins-text
status: fixed
reviewed: true
pattern: source-scan-pins-text
---
**Expected:** Adding Disengage's withdrawal to the defenders filter, and Curse (Bolg)'s card to `io.log`'s revival
filter, changes no behaviour those tests guard.
**Actual:** `ozymandias.test.mjs` failed: `expected '…' to match /const defenders = targets\.units\.filter\(\(t\) =>
!killedCivilians\.has\(t\.unitId\)\)/`; `vlad-333.test.mjs` failed: `/x\?\.kind === "revivalHeld"\)/`. Both scan the
source for a whole expression, which any edit to the line breaks.
**Cause:** `test/unit/ozymandias.test.mjs` and `test/unit/vlad-333.test.mjs @ cc1d8e41` — each pins the text of one line,
not a named marker (the `source-scan-pins-text` pattern).
**Fix:** `test/unit/ozymandias.test.mjs:126` and `test/unit/vlad-333.test.mjs:198 @ d3452f94` — both now match a
named marker, `fgt-scan: civilians-are-no-defenders` (`engine/attack.mjs`) and `fgt-scan: revival-cards`
(`engine/io.mjs`, whose filter became one `Set`), as the pattern's lesson asks (review 2026-10-26).
