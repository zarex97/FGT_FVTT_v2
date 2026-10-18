---
id: 2026-10-17-item-pickup-said-nothing
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** A Unit walking onto the Vorpal Blade is told what happened: it took the sword, or why it could not.
**Actual:** Heracles took it: BA(STR) 160 → 210, Range 2 → 1, the cache gone, and no card. A Trump Soldier and her Master stood on it and nothing at all happened that a player could read.
**Cause:** `module/rules/items.mjs#itemPickupIntents @ eebbb988` wrote the grant and an `itemPickedUp` log entry, which `io.log` filed and nothing read; a refusal returned nothing. The Trump Soldier's refusal also shared the reason `barred` with Nursery's own bar.
**Fix:** `module/engine/item-report.mjs#postItemLine @ uncommitted`, called from `io.log` for `itemPickedUp` and the new `itemRefused`; `acquisitionTarget` names `notItsKind` apart from `barred`. Re-pressed: all three lines on Player1's chat.
