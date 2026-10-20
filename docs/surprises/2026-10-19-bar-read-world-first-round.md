---
id: 2026-10-19-bar-read-world-first-round
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** War *Heracles Audit*, set up with `noAttackRound: 0`, lets Heracles Attack in Round 1, as its preflight does.
**Actual:** every Attack slot on Player1's bar greyed: *"Attack — no attacks are permitted during the first Round"*, and *"Nine Lives — no attacks are permitted during the first Round"*.
**Cause:** `module/engine/budget.mjs:56 @ d64553fc` — `affordable` and `endTurnVerdict` read `game.settings.get("fgt", "noAttackRound")`, the world's default, while `engine/attack-preflight.mjs` read `warRule("noAttackRound")`. The two readers were missed when War Rules moved onto the War.
**Fix:** `module/engine/budget.mjs:60 @ ded45740` — both read `warRule("noAttackRound", combat)`. A sweep of every `settings.get("fgt", <War Rule>)` found no other. `test/unit/first-round-war-rule.test.mjs`.
