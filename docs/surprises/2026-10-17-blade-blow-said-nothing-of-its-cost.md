---
id: 2026-10-17-blade-blow-said-nothing-of-its-cost
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** The Blade's blow on the Jabberwock says its two other consequences: the sword breaks, the lifesteal is gone for good.
**Actual:** Heracles' card read *"905 … Health 95 → 773"* and nothing else. The Blade was gone from his items and `suppressedScopes` read `[jabberwockLifesteal]`.
**Cause:** `module/engine/applier.mjs#applyIntents @ eebbb988` printed a handler's clocks, stats and spans; an `itemQuantity` and a `suppressRule` wrote and printed nothing.
**Fix:** `module/engine/applier.mjs#itemLines`, `#suppressionLines @ uncommitted`, keyed by the Item and the rule's slug in `lang/en.json`. Re-pressed: *"[Vorpal Blade] breaks and can no longer be used"*, *"Its lifesteal is removed for good"*.
