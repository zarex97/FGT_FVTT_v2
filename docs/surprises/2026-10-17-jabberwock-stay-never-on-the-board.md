---
id: 2026-10-17-jabberwock-stay-never-on-the-board
found: test
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** The Jabberwock disappears after 3◈: the Round end's dismissal names it once its `expiresAt` has passed.
**Actual:** Testing Alice Eater: `DurationDelta` read `u.expiresAt` off the board unit and found nothing. The summon writes `system.expiresAt` (27) and the board never carried it, so the dismissal (`rules/summons.mjs`) never named a Jabberwock either: it stayed for good.
**Cause:** `module/rules/snapshot.mjs#unitSnapshot @ eebbb988` projected no `expiresAt`; its two readers asked the board.
**Fix:** `module/rules/snapshot.mjs @ 7755ebb4` projects it; `nursery-247-rulings.test.mjs` dismisses at 27 and not at 36.
