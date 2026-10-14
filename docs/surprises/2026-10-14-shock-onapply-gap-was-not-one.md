---
id: 2026-10-14-shock-onapply-gap-was-not-one
found: retraction
kind: claim-without-reading-the-path
status: wontfix
reviewed: false
---
**Expected:** Shock landed by a rider or a Skill never pays its "current Agility −3", because `def.onApply` is dispatched only by the adapter (`module/engine/applier.mjs:423 @ 1a0123e`), and every direct `applyEffect` caller emits `resolved: true` intents the adapter skips. An explorer read it so, and I put it to the user as four changes to play (Scáthach's Þurs, Raikou's NP and Mana Burst, Quetzalcoatl's spell), which were accepted.
**Actual:** played in the arena, Scáthach's Þurs lands Shock through the rider loop and Heracles's current Agility falls by 3. It still falls by 3 with the adapter's `onApply` switched off. The −3 reaches the rider path some other way.
**Cause:** `module/engine/applier.mjs:423 @ 1a0123e` was read as the only payer of the −3 without running any path that lands Shock; the claim went to the user unproven, marked "unverified live" by the explorer and dropped as a caveat on the way.
**Fix:** none needed. `test/unit/landing-changes.test.mjs` keeps the −3 on the rider path so the door cannot lose it; the four Shock rows leave Wave B's changes to play.
