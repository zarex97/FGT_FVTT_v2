---
id: 2026-10-31-total-defdwn-named-by-id
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** A card names an effect by its name: 'Def Dwn (Total)'.
**Actual:** Stage 15 read 'totalDefDwn defDwnTotal (Total ×1.25)'.
**Cause:** `module/rules/damage/pipeline.mjs:1223 @ 219a56dc` — the note was a built string, so `explain.mjs` could not look the id up.
**Fix:** `module/rules/damage/pipeline.mjs:1225 @ 9d2236d7` — the id alone as the note; unit-tested, not yet re-seen on a live card.
