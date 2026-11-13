---
id: 2026-11-13-expend-line-named-np-by-label
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** A line names an ability by its public name: a Public Tag while its bearer is concealed.
**Actual:** The card read *"Test Intel: Glory: can no longer be used for the rest of the game."* on the GM's public card for an unrevealed Lancelot.
**Cause:** `module/engine/scheduler.mjs:1773 @ 6315e1e`: the line's label was the authored `label` or the handler's source, the Item's real name, past `shownAbility`.
**Fix:** `module/engine/applier.mjs:485 @ 0d3920a`: a line carrying `abilityIds` names each by `shownAbility`; the stored card reads *"NP-6B6GV: …"*.
