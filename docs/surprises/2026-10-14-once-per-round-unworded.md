---
id: 2026-10-14-once-per-round-unworded
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** After Karna switched Uncrowned Arms Mastership at the start of his Combat Phase, its greyed slot says why in words, as every other refusal does (§46.4-LJ).
**Actual:** The slot read "Uncrowned Arms Mastership — oncePerRound", the raw reason key.
**Cause:** `lang/en.json:977 @ 7333e08` — the use gate's reason `oncePerRound` had no `FGT.Ability.Refused.*` entry; `oncePerTurn` beside it had one, and `abilityRefusal` falls back to the key.
**Fix:** `lang/en.json @ 95b91ea` — "Already used this Round".
