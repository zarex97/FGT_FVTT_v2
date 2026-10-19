---
id: 2026-10-19-relation-any-passed-validation
found: test
kind: unknown-value-falls-to-default
status: fixed
reviewed: false
---
**Expected:** Doppelganger's `selection: { relations: [any] }` either targets every Unit, as Serenity's Zabaniya cloud reads `any`, or `npm run validate:content` refuses it.
**Actual:** validation passed, and every use refused: "No legal targets: Caster is enemy; this ability targets any." Two readers of one word: the scheduler's `nearby` handler accepts `any` (`engine/scheduler.mjs#matchesRelation`), the targeting resolver never did (`rules/targeting/resolve.mjs` step 4), and the validator checked neither.
**Cause:** `tools/lib/content.mjs:1633 @ 27ef5aa0` checked a selection's `chooser` against `CHOOSER_IDS` and nothing checked its `relations`.
**Fix:** `module/rules/targeting/vocabulary.mjs#RELATION_IDS` and its check in `tools/lib/content.mjs @ cce1f438`: an unknown relation in a targeting selection is an error at build. Proved by writing `any` back and reading the error. Doppelganger names `[enemy, ally, neutral]`.
