---
id: 2026-10-31-form-end-writes-unsaid
found: live press
kind: producer-without-consumer
status: open
reviewed: true
pattern: producer-without-consumer
---
**Expected:** The Form ending says what it took: Health 2000/2400 → 1200/1200, two Shiisaa Counters, the Pretender (>X).
**Actual:** Only 'Master … does not extend Pretender's Shisarot Form: it ends.' (ticks 24, 30).
**Cause:** `packs/_source/effects/shisarot-form.yml:21 @ 7b1e3c86` — its `onRemove` and the Max Health fall run in the Turn-end batch with no line.
**Fix:** Open: reported to the user.
