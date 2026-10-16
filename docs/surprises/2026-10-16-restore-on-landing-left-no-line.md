---
id: 2026-10-16-restore-on-landing-left-no-line
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Expert of Many Specializations on Hassan 4 (Luck 1/5) lands LUC Up and the card says Luck went 1 → 4.
**Actual:** the card read "LUC Up (rolled 30 vs 70%)" and nothing about Luck; the sheet showed 4.
**Cause:** `module/engine/skill-use.mjs:1160 @ ef0d49e` — an effect's `onApply` writes (`landing.mjs#landedIntents`) are part of the landing and never reached the card; the card prints the summary alone.
**Fix:** `module/engine/skill-use.mjs:1160 @ ef0d49e` — `applyPhaseEffects` reads each `onApply` stat before and after and appends the `resourceLine` to the applied row.
