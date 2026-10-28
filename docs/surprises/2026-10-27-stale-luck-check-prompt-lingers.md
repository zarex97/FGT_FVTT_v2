---
id: 2026-10-27-stale-luck-check-prompt-lingers
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** A Prevention Luck Check that times out closes its window on the player's screen.
**Actual:** Bleed's *"Contest with a Luck Check? Sieg may make a prevention Luck Check … (1 left)"* (as Siegfried, Luck 1) was still open on Player1's screen a Turn later, and two more stacked up by the end; one blocked a page script for 45s.
**Cause:** `module/engine/landing.mjs:211 @ 6ef9ce96` — the ask times out on the GM and the effect lands; nothing closes the player's dialog.
**Fix:** `module/net/socket.mjs:198 @ a6b12a1b` — a timed-out ask emits `withdraw`, and `apps/prompt.mjs#withdrawPrompt` closes every window it opened. Pressed live: a 15s ask to Player1 opened the window and closed it at the timeout.
