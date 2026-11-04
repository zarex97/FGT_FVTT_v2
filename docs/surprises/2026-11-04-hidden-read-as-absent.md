---
id: 2026-11-04-hidden-read-as-absent
found: user
kind: rule-word-read-one-way
status: fixed
reviewed: false
---
**Expected:** I picked that Sakura Eater's *"within a 3 panel area of herself"* counts only Units she sees, so a hidden BB feeds nothing and the card leaks nothing.
**Actual:** The user: *"Hidden is different from unreachable or intangible."* A hidden Unit is there, and it counts. Bug Space is what is off the board.
**Cause:** `module/rules/count.mjs:206 @ 35c9fee5` — the reader already counts every standing Unit, as Habetrot's does. I put the leak rule above what the sheet states, and treated *"may not see"* as *"is not there"*.
**Fix:** `docs/superpowers/specs/2026-11-04-kazuradrop-clauses.md @ cb28c87d` — reading 12: every Unit truly there counts, the reader unchanged.
