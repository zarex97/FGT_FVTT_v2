---
id: 2026-10-17-regen-heal-said-nowhere
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Arjuna's Regen heals 15% at the end of his Turn and the table sees it, as the End of the Turn card
says every Health loss (#190).
**Actual:** live, Round 3 tick 7: Arjuna went 1089 -> 1250 at his Turn's end and the only card read *"Master of Lancer
of Faction 2 loses 20 Health (Kavacha and Kundala: O' Sun, Become Armor)."* The same card named every Unit by its
actor name, a True Name for a Servant.
**Cause:** `module/engine/turn-report.mjs:89 @ 5ecdefeb` — the card read `statDelta` on Health alone, and a heal
is its own `heal` intent; the Round's end posted no Health card at all. Its names were a second reader of "what this
Unit is called in public" beside `publicIdentityOf`, as was the periodic card's.
**Fix:** `module/engine/turn-report.mjs:165 @ 5ecdefeb` — heals are said as what they gave (clamped at the maximum
read before the batch, `healthBefore`), at the Turn's end and on an "End of the Round" card; both cards and the
periodic card name Units by `publicIdentityOf`.
