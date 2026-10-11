---
id: 2026-10-11-mode-slot-gated-by-activation-cost
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** An active Tenmōkaikai can be ended from her bar (reading 14).
**Actual:** The slot was greyed: "Goō Shōrai・Tenmōkaikai — The Master cannot pay the Health cost".
**Cause:** `module/apps/hud/action-bar.mjs:250 @ f15a3d1` — the bar asked `canUseAbility`, the activation gate, of a slot whose press would end the mode. The toggle path asks `canToggleMode`.
**Fix:** `module/apps/hud/action-bar.mjs:697 @ uncommitted` — an active toggle's slot asks `endVerdict`, which is `canToggleMode` with `active: false`. Seen live: the slot is pressable while active.
