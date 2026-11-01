---
id: 2026-11-01-rule-breaker-stole-independent-action
found: live press
kind: rule-word-read-one-way
status: wontfix
reviewed: true
pattern: rule-word-read-one-way
---
**Expected:** Gray's Independent Action A+, *"Cannot be contracted by enemy Casters and Masters"*, would keep Medea's Rule Breaker from taking her: the table's top band is *"absolute … Rule Breaker's bypassesContractRoll does not defeat it (Q48)"*.
**Actual:** Rule Breaker on Gray: Gray's `masterId` became Medea, her faction Faction 2 and her owner Player2; her Master's Command Spells were stripped.
**Cause:** I carried Q48 as settled. `module/engine/attack.mjs#cutContract @ 498eb1f4` writes `markContract(…, "contracted", caster)` without asking `rules/contract.mjs`'s immunity (`rollsRequired` → Infinity → "immune"), which only `attemptContract` asks.
**Fix:** None to the engine: ruled 2026-11-01 (#362 Q11), Rule Breaker ignores Independent Action, *"they are not being contracted in the traditional way of the word... Rolling dice or by conquest"*. Q48, which I carried as the rule, is overturned in `docs/A-effect-catalogue.md`, `docs/B-rank-tables.md` and `domain/tables.mjs`. The board was right.
