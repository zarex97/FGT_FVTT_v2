---
id: 2026-10-14-escape-rung-draws-no-ability
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** A reaction ability the escape rung's prompt offers is a button on the card, as on the reaction rung.
**Actual:** Heracles's failed Evade reached `s23_acceptOrEscape` with `options: ["accept", "ability:fvdg1f2wcryb3yx8"]` (Eye of the Mind (False)), and the card drew Accept alone.
**Cause:** `module/apps/chat/cards.mjs:383 @ 4983091` — `promptOptions`'s `acceptOrEscape` branch returns its own fixed buttons and never maps `prompt.abilities`, which the `reaction` branch does.
**Fix:** `module/engine/combat-process.mjs:354 @ uncommitted` — ruled 2026-10-14: no ability answers after a failed Evade, so the producer was wrong, not the card: `pendingPrompt` lists reaction abilities on the `react` rung only.
