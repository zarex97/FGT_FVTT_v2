---
id: 2026-10-20-blind-premise-missed-the-cancel
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** #258 reading 6, as I put it to the user: Watermelon's self-inflicted Blind *"rolls like any debuff: 100 less her Fae Contract's 5, so it fails 5% of the time."*
**Actual:** it never failed. Fae Contract is +5 outgoing as well as +5 incoming, and on her own Blind she is both inflicter and target, so the chance is 100 + 5 − 5 = 100, automatic. `test/unit/skill-path-resistance.test.mjs` already said so: *"Anastasia's Blind still lands: 100 + 5 - 5 (Fae Contract, both ways)"*.
**Cause:** `module/engine/effect-applier.mjs:197 @ 50eae993` — I read the resistance half of `applicationChance` and not the `inflictBonus` beside it, and did not grep the tests for her Watermelon before stating a failure rate.
**Fix:** `packs/_source/abilities/anastasia-summer-watermelon.yml @ 0552085c` — the ruling stands and is now stated, not an accident of two equal numbers: `bypassChanceModifiers: true`, so no bonus or resistance touches it. Reading 6's premise is corrected in the Clause list.
