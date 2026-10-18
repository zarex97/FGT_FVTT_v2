---
id: 2026-10-17-killed-jabberwock-started-no-cooldown
found: retraction
kind: generic-path-escapes-special-case
status: fixed
reviewed: false
---
**Expected:** Ruled (#247 reading 11): a killed Jabberwock has disappeared: the 5◈ cooldown starts, and it returns at full Health, still without the lifesteal the Vorpal Blade took.
**Actual:** Read for the ruling: only the timed departure (`io.dismissSummon`) wrote the summoner's `fieldSummonStats` and started the `countFrom: destroyed` clock. A killed one left by `defeat` and `clearBody`: no cooldown, so she could summon it again at once, and the Blade's removal was lost.
**Cause:** `module/engine/io.mjs#dismissSummon @ eebbb988` held the departure record; the defeat door had none.
**Fix:** `module/engine/io.mjs#rememberDeparture @ uncommitted`, called by both doors; `nursery-247-rulings.test.mjs` kills one and reads the cooldown and the record.
