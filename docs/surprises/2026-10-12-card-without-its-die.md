---
id: 2026-10-12-card-without-its-die
found: live press
kind: producer-without-consumer
status: open
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Territory Creation's 3d10+30 and a Contract Servant attempt each leave a line others can read.
**Actual:** the negation shows "−40" with no Rolls entry; the contract's three dice only reach the attempter's notification.
**Cause:** the negation's roll is not filed in the card's Rolls, and `apps/contract-dialog.mjs` posts no card.
**Fix:** open.
