---
id: 2026-10-15-clairvoyance-die-unshown
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Clairvoyance's 80% chance of Evade- shows its die on the Evade's Rolls.
**Actual:** "Heracles evades EMIYA evade- 1d20 → 8 unfavourable table" and nothing else; the 1d100 was rolled and filed nowhere.
**Cause:** `module/engine/attack.mjs#rollEvade @ 960496f` — `rollCheckChances` rolled, `checkPlan` consumed the roll, the record kept only the d20.
**Fix:** `module/rules/checks.mjs#checkPlan @ 3cc6a34` returns `chances`; `rules/roll-log.mjs#fromCheck` writes "Clairvoyance: 1d100 → 43 against 80%, in force".
