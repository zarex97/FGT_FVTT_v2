---
id: 2026-10-16-gate-weighed-the-superseded-cost
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Enki costs its Master half his maximum *"instead of the normal Master's Health cost"*, so a Master on
95 of 115 can pay its 57 and the bar offers it (#232).
**Actual:** the slot greyed *"Enki: Sword of the End — The Master cannot pay the Health cost"* at 95 of 115.
**Cause:** `module/rules/costs.mjs:530 @ 2e097ec` — the use gate weighed the NP table's cost alone (EX: 100),
while the payment resolves the ability's own costs against it (`resolveCosts`, `supersedes: [npCost]`): two readers
of what a use costs. Ozymandias's Ramesseum Tentyris carries the same `supersedes` and was never pressed with a
Master under 100.
**Fix:** `module/rules/costs.mjs:530 @ 2e097ec` — the gate resolves the charged costs the payment will charge,
summed per pool; the usage spec carries `additionalCosts`.
