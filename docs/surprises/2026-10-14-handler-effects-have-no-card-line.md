---
id: 2026-10-14-handler-effects-have-no-card-line
found: live press
kind: producer-without-consumer
status: open
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Every outcome Landing decides gets a line a player sees, whatever the path (ruled 2026-10-14).
**Actual:** Suppression's Atk Up, landed through a handler, shows on no card; only the strip's own line does. The rider loop's rows reach the card, the adapter's do not.
**Cause:** `module/engine/applier.mjs:290 @ 5770aca` — `resolveEffects` lands through the door inside `applyIntents`, which returns no rows to any card.
**Fix:** Open, #202: needs a place for the adapter's summaries to reach the Process card.
