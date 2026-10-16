---
id: 2026-10-15-killing-blow-forced-the-mode-off
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** the Master of Saber falls with Castor's Mad Enhancement on: Castor's Sustainability −2◈ (clause 5), Pollux's untouched.
**Actual:** live, the Master staged to 1 was forced off at once ("its Master's Health is at its limit"). In the arena, one blow from 148: the card read "Mad Enhancement forcibly deactivated", and Castor's `sustainabilityRemaining` stayed null.
**Cause:** `module/rules/modes.mjs#forcedOffNow @ 960496f` — the forced deactivation is a state read at any moment, and the killing blow's own Health drop met it (0 ≤ 20) in `reconcileForcedModes` before `io.mjs`'s defeat path asked whether the mode was on. Clause 5 could never charge any Mad Enhancement bearer.
**Fix:** `module/rules/modes.mjs#forcedOffNow @ 3cc6a34` — the engine's sweep leaves a Master at 0 to the defeat path (`masterDefeatAnswers`), while a compulsion still reads the valve (the code review); `dioscuri-209-live.test.mjs` fells the Master in one blow: Castor 6 → 0, Pollux uncharged.
