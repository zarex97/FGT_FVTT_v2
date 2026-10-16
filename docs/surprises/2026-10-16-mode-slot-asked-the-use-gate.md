---
id: 2026-10-16-mode-slot-asked-the-use-gate
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** with Invisible Air suspended by Strike Air until tick 19, its slot greys at tick 17 and says why (#230 IA.lock, SA.ia).
**Actual:** the slot was lit; the press refused with "Invisible Air: Bounded Field of the Wind King is suspended and cannot be switched on yet." The second time in this audit the bar and the switch disagreed on one mode (Round 1's "Ready from Round 2" was the first, patched then with `ignoresNPGate` and the wider split left standing).
**Cause:** `module/apps/hud/action-bar.mjs:259 @ b4464ed` — a mode's slot asked `canToggleMode` only to switch OFF and the use gate to switch ON; the press asks `canToggleMode` both ways and the use gate only for a mode `pricedOnEntry`. Neither the suspension nor the lockout is the use gate's.
**Fix:** `module/apps/hud/present.mjs#modeSlotVerdict @ uncommitted` — the slot shows the verdict the press acts on: the switch's own, then the use gate for a priced mode only. Tests in `action-bar-present.test.mjs`.
