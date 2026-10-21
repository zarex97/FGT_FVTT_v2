---
kind: stale-render
lesson: A control that renders on one event is stale after any other change it reads.
landed: none
---
**Mechanism:** The action bar renders its slot verdicts when a Unit is controlled; another Unit's move changed the verdict and the slot kept refusing until she was reselected. Gilles de Rais (Saber) (#260) added the third: Heracles's bar kept its ZON refusal after his Master moved into range.
**Lesson:** List every input a rendered verdict reads and re-render on each of them, or recompute at the click. Fixed in #261: the bar hears every hook a verdict reads (`BAR_REFRESH_HOOKS`).
**Surprises:** [2026-10-12-bar-kept-zon-refusal](../2026-10-12-bar-kept-zon-refusal.md) · [2026-10-14-bar-kept-replaced-copies](../2026-10-14-bar-kept-replaced-copies.md) · [2026-10-20-bar-stale-after-another-unit-moves](../2026-10-20-bar-stale-after-another-unit-moves.md)
