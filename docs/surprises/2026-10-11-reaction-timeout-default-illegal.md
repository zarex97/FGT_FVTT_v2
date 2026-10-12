---
id: 2026-10-11-reaction-timeout-default-illegal
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** when nobody answers a reaction prompt in time, the defender takes the hit. `rules/await-policy.mjs` says the default is "the option that spends nothing".
**Actual:** at Mannanán's live press (#197), the prompt timed out and threw `Illegal Combat Process transition "react:none". Legal events from "react": nothing, block, evade.` from `applyExpiry`. The card stayed at its rung until it was clicked.
**Cause:** `module/rules/await-policy.mjs:35 @ 75ae578` — the reaction default was `"none"`. The ladder's own event is `"nothing"` (`engine/combat-process.mjs` `PROMPTS.react.options`). Two tables named the same answer two ways, and no test held one against the other.
**Fix:** `module/rules/await-policy.mjs:35 @ 57c23ae` defaults to `"nothing"`. `test/unit/await-policy.test.mjs` checks every timeout default against `legalEvents` for its rung.
