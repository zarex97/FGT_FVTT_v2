---
id: 2026-10-23-mid-ladder-clock-cuts-said-nothing
found: test
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Chiron's Clairvoyance Passive 2 (a cut on every Normal Attack at Range 3+) and Eye of the Mind's cut
on a successful Evade are lines on the Process's card, as a settle and an `afterProcess` refund now are.
**Actual:** `chiron-326.test.mjs` read the clocks 6 → 5 and 9 → 8 and no `cooldown` row on any card. Two causes:
the `attackDeclared` and `evadeSucceeded` batches dropped their lines, and the Damage Step then *replaced* the card's
rows with its own, so a row said at the declaration would have gone anyway.
**Cause:** `module/engine/attack.mjs:2980 @ 706f5fde` and `:3620` applied with `applyBatch`, which returns lines
nobody reads; `:4359` wrote `effects` with `cardRows([...])` and no earlier rows. Same mechanism as
`2026-10-23-afterprocess-clock-said-nothing`, at two more doors.
**Fix:** `module/engine/attack.mjs#applyOnCard @ uncommitted`: one helper puts any handler batch's lines on its
Process's card (`processMessageOf` finds it from the state); the Damage Step keeps what was said before it
(`effectsBeforeDamage`, so a step run again writes the same card). Tests in `chiron-326.test.mjs` (CV*, EM*) red first.
