---
id: 2026-10-16-watermelon-granted-an-unread-name
found: test
kind: unknown-value-falls-to-default
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** Watermelon grants Ignore Def beside Pierce, and the attack spec carries it.
**Actual:** `packs/_source/abilities/anastasia-watermelon.yml` granted `property: ignoreDef`; every reader asks
`ignoresDefUp`, so the grant was stored and read by nobody, and validation passed.
**Cause:** `tools/lib/content.mjs:1399 @ 5ecdefeb` — `AttackProperty.property` was free text: an unknown name
authored cleanly.
**Fix:** `tools/lib/content.mjs:1399 @ 5ecdefeb` — `ATTACK_PROPERTIES` is the closed set the engine reads and the
validator refuses any other; Watermelon grants `ignoresDefUp`.
