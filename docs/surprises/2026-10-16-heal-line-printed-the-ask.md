---
id: 2026-10-16-heal-line-printed-the-ask
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Battle Retreat on Hassan 3 at 750/750 says the heal did nothing.
**Actual:** the card read "Health +300".
**Cause:** `module/engine/skill-use.mjs:569 @ 907b345` — the `heal` phase printed the amount it asked for, not the change the Health bar took; a full bar clamps it to 0.
**Fix:** `module/engine/skill-use.mjs:569 @ ef0d49e` — the line prints before → after and the real gain.
