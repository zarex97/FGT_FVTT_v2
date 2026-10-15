---
id: 2026-10-15-counter-against-joint-np-already-aims-at-declarer
found: test
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** the ticket: a Counter against the joint NP must be made to answer the twin who used it — implied built otherwise (lead, pair, or whichever is nearer).
**Actual:** pressed first, with the NP declared by Pollux at a foe only Castor's Range reaches: the foe that reaches Pollux was offered the Counter and its Process is aimed at Pollux (`requiredTargetId` Pollux); a placement holding only Castor was refused with `FGT.Counter.MustIncludeAttacker` and nothing spent; a foe that cannot reach Pollux was not asked. All green on first run.
**Cause:** `module/engine/attack.mjs:3608 @ 7231295` — `counterAvailable` tests Range to `state.attackerId` and `runCounter` aims at `state.counterRedirectId ?? state.attackerId` (`:3683`); the NP's `alsoCountsAsAttackFor: partner` touches the budget alone. Nothing about the joint attack reaches the Counter.
**Fix:** none needed; `dioscuri-209-arena.test.mjs` pins it. Aiming the Counter at the declarer's partner instead fails two of the three.
