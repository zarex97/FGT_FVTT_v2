---
id: 2026-10-23-targets-plus-one-had-no-reader
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Dracula Vlad's Normal Attack takes two targets, the two closest, an ally among them (#330 rulings 14,
18): his sheet read Targets 2.
**Actual:** R52 Player1's targeting read "Normal Attack: 1 target(s)", and an ally the compulsion named could not be
picked at all.
**Cause:** `module/rules/ability-use.mjs:437 @ ae843342` — a bare Normal Attack's spec is `count: 1` and `relations:
[enemy]`, always; `range.targets` reached the sheet and `maxTargets` and nothing that targets. The test asked the
projection (`maxTargets: 2`), not the Attack.
**Fix:** `module/rules/ability-use.mjs:430 @ 2f651e0b` — `maxTargets` above 1 makes it a pick of that many within
Range, and a compulsion's own `relations` make an ally it names a legal target.
