---
id: 2026-10-27-stale-luck-check-prompt-lingers
found: live press
kind: hidden-timing-rule
status: open
reviewed: false
---
**Expected:** A Prevention Luck Check that times out closes its window on the player's screen.
**Actual:** Bleed's *"Contest with a Luck Check? Sieg may make a prevention Luck Check … (1 left)"* (as Siegfried, Luck 1) was still open on Player1's screen a Turn later, and two more stacked up by the end; one blocked a page script for 45s.
**Cause:** `module/engine/landing.mjs:211 @ 6ef9ce96` — the ask times out on the GM and the effect lands; nothing closes the player's dialog.
**Fix:** Open: not fixed in #345.
