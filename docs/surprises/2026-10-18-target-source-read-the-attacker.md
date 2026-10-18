---
id: 2026-10-18-target-source-read-the-attacker
found: test
kind: unknown-value-falls-to-default
status: fixed
reviewed: false
---
**Expected:** Yuugao's base, *"damage equivalent to the DU's current Health"*, authored as a damage source `{unit: target, stat: currentHealth}`, adds up the defender's Health (#249 reading 22).
**Actual:** `stage1Base` resolved `src.unit` as `"self"` → the attacker, a named Unit (`mount`, `partner`) → that Unit, and anything else → the attacker again, and only ever read `baseAttack[component]`. A `unit: target` source would have been Danzō's own BA(STR), with no word from the build.
**Cause:** `module/rules/damage/pipeline.mjs:367 @ 27c1e9c2` — `(s.ctx.units?.[src.unit] ?? s.ctx.attacker)`: an unknown unit fell to the attacker, and `tools/lib/content.mjs#damageBlocksAreKnown` checked a block's keys but not a source's `unit`.
**Fix:** `module/rules/damage/pipeline.mjs#stage1Base @ uncommitted` reads `unit: target` off `ctx.defender` (`stat: currentHealth`); `tools/lib/content.mjs#damageBlocksAreKnown @ uncommitted` refuses a source naming any Unit but `self`, `target`, `mount` or `partner`.
