---
id: 2026-10-16-bar-gated-a-free-np-switch
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Invisible Air, switched off in Round 1 as Player1, can be switched back on next Turn: "at any time, once per Turn" (#230 reading 10).
**Actual:** the bar's Mode slot greyed "Invisible Air: Bounded Field of the Wind King — Ready from Round 2 (1 away)", while `system.active` had gone false through the same press.
**Cause:** `module/apps/hud/action-bar.mjs:259 @ b4464ed` — a mode switched ON asks `canUseAbility`, whose NP Round gate (`rules/np-gate.mjs#isGated`) holds every NP; the switch itself asks only `rules/modes.mjs#canToggleMode`, which knows no Round. Invisible Air is the corpus's first free NP mode, so the two readers had never disagreed on screen.
**Fix:** `packs/_source/abilities/arturia-invisible-air.yml:31 @ 9d0ab57` — `ignoresNPGate: true`: on from the summon, switched at any time, no Round gate holds it. Test in `test/unit/arturia-230.test.mjs`. The wider split (a free mode's bar asks the use gate, its press the mode gate) stays as it was.
