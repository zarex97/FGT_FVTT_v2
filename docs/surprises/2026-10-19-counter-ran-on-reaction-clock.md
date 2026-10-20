---
id: 2026-10-19-counter-ran-on-reaction-clock
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** Heracles' Normal Attack on Karna, who could Counter (`counter` flag `{available: true}`), stops at the Counter rung and asks Player2.
**Actual:** three times, the ladder read *"counter → declined"*. Watching Player2's card each second, the state went `injury` → `done` and no Counter button was ever drawn.
**Cause:** `module/engine/await-timeout.mjs:98 @ d64553fc` — `promptStartedAt` was stamped once per CARD, at its first prompt (the reaction), and never moved. The `updateChatMessage` hook re-armed the timer "because the old deadline is meaningless" and re-read the same stamp, so the Counter's 45 s ran from the reaction; two 15 s Command Spell windows later it had expired before it was drawn.
**Fix:** `module/engine/await-timeout.mjs:57 @ ded45740` — the clock is keyed to its prompt (`promptKey`: kind, rung, ladder length, who is asked); a prompt not yet stamped has its whole time left. `test/unit/await-timeout.test.mjs`.
