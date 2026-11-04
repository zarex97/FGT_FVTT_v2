---
id: 2026-11-04-stored-card-is-the-gms-view
found: user
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** `fillAttackCard`'s comment says *"a client that fails to re-render keeps the stored content, which is why that content ships REDACTED rather than complete."* I told the user the stored card only *"still names its sources for the frame before its re-render."*
**Actual:** Asked what a stored card is, I read one. Its content holds the full breakdown, *"GM · both sides"*, the Attack's preview and every Master's Command Spell buttons. It is not redacted at all, and a player's client shows it again at every rung.
**Cause:** `module/apps/chat/cards.mjs:417 @ 87321127` — `cardContext` asks `game.user`, and every write runs on the active GM, so the copy that ships is the GM's. I named one symptom from memory without reading the stored text.
**Fix:** `module/apps/chat/cards.mjs @ 8d60cf20` — `cardContext` builds a stranger's view unless `forViewer`, and the screen, not the console, is what it guards (#388).
