---
id: 2026-10-28-curse-ticks-every-turn-end
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** I read `curse.yml`'s *"at the end of the affected unit's turn"* as her Turn only. Appendix A says *"at the end of the turn, every ⅓◈"*: every Turn at three a Round, every second at eight (the user, 2026-10-28).
**Actual:** A staged Curse on Sita (Faction 1) ticked "End of the Turn Archer takes 25 from Curse" at the end of Faction 2's Turn and of the GM's Turn too.
**Cause:** `packs/_source/effects/curse.yml:14 @ 3d122db3` — `periodic: {when: turnEnd}` ticked at every Turn's end whatever the Round's length, and the description named the bearer's Turn.
**Fix:** `module/rules/periodic.mjs:57 @ 2e9b2de6` — `periodic.every: "⅓◈"`, counted from the Turn it lands (`periodicDue`), on Curse and Curse (Bolg); the description says so. Live at eight Turns a Round: ticks at the end of Turns 26 and 28, none at 27.
