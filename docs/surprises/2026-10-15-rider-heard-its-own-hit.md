---
id: 2026-10-15-rider-heard-its-own-hit
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** the joint NP hits Heracles for 734, "then" inflicts Def Dwn (A) and (C). Their Luck and Agility drains wait for the next damage he receives.
**Actual:** the log showed `damageTaken` heard by `defDwnA` and `defDwnC` from that same hit. Luck 20 → 19, and Agility one past what the Injury took.
**Cause:** `module/engine/attack.mjs` damage step `@ 960496f` — `fireDamageTaken` was raised after `applyAbilityEffects`, so the riders the attack had just inflicted heard the damage that came before them.
**Fix:** `module/engine/attack.mjs` damage step `@ 3cc6a34` — `damageTaken` is raised as the damage lands, before the riders; `dioscuri-209-live.test.mjs` plays the NP on Heracles and his Luck stays.
