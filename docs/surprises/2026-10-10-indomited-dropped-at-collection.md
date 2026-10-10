---
id: 2026-10-10-indomited-dropped-at-collection
found: live press
kind: event-option-judged-at-collection
status: fixed
reviewed: false
---
**Expected:** Nemo, killed with Guts and Indomited on him, is revived with 20% and his NP Cooldown drops by
1◈+⅔◈ (12 → 7).

**Actual:** "Nemo is defeated and revived by guts, with 250 Health." NP Cooldown stayed 12; Indomited
still held its one use. His projection had no `unitRevived` handler at all.

**Cause:** `module/rules/elements.mjs:229 @ 08ea4b1` — `DEFERRED_PREFIXES` decides which predicates wait
for the event; `revival:` was not among them, so `revival:source:guts` was answered at collection time
against options that can never hold it, and the handler was dropped. `nemo.test.mjs` asserted the YAML's
predicate, not the projection.

**Fix:** `module/rules/elements.mjs @ d162f50` — `revival:` is deferred; a test projects Indomited
through `withSubjects` and fires `unitRevived` with and without the Guts source.
