---
id: 2026-10-23-unparalleled-gate-said-nothing
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** with another allied Servant's Attack already made this Turn, Unparalleled's card says its third
effect was not applied (#328 ruling 11, UP.gate).
**Actual:** pressed live 2026-10-23, Round 42: the card listed NP DmUp, S.Crit Up, NP Seal and Heal Dwn and said
nothing of Unparalleled. A player could not tell the gate from a lost effect.
**Cause:** `module/engine/skill-use.mjs:629 @ 7f02a2c2`: a phase its `predicate` holds back is skipped with
`continue`, and no phase could name why.
**Fix:** `module/engine/skill-use.mjs @ 7f02a2c2`: a phase's `unmetLine` is a refused row on the card;
Unparalleled's phase states `FGT.Unparalleled.NotApplied`. `olga-328.test.mjs` "is not applied when another allied
Servant has already Attacked" was red first.
