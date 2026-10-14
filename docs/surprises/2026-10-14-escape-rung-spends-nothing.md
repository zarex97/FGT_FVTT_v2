---
id: 2026-10-14-escape-rung-spends-nothing
found: test
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** The escape rung's "Spend a Command Spell" button spends one.
**Actual:** Its `cs` event advances `s23_acceptOrEscape` to `noDamage`, and no code anywhere spends a Command Spell for it.
**Cause:** `module/engine/combat-process.mjs:72 @ 4983091` — the transition exists; `apps/chat/cards.mjs:391` offers it as an ordinary step; nothing reads `cs` to charge a Master.
**Fix:** `module/engine/combat-process.mjs:126 @ cde0483` — ruled 2026-10-14: the `cs` option and its transition are gone; the rung's escape is the paid Escape the card offers at that window. Pressed: Heracles's failed Evade reached the rung with Accept and "Escape 1 CS" and nothing free.
