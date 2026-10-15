---
id: 2026-10-15-window-only-ability-pressable
found: test
kind: generic-path-escapes-special-case
status: fixed
reviewed: false
---
**Expected:** removing `ownTurn` from Reinforcement's window list ("used at the start of a Combat Phase", not any time
in his Turn) was the whole of reading 8 for the sheet button: with no `ownTurn` there is no button.

**Actual:** (read, then proved by the gate test) an ability whose windows exclude `ownTurn` classifies as an active
Skill and `canUseAbility` has no window gate, so it stayed pressable from the sheet or the bar at any time. Trofa, Eye of
the Mind (True) at B, Rho Aias and the 11 others that name windows and no `ownTurn` were the same, and `Trofa` passed
the gate at 7231295 with `{ok: true}`.

**Cause:** `module/rules/windows.mjs:174 @ 7231295` — `usedOnlyDuringOwnTurn` refuses an ability whose ONLY window is
`ownTurn` on another Turn, and nothing refused the converse. The generic path (the use gate) offered an exit the sheet
rules out.

**Fix:** `module/rules/costs.mjs:263 @ 3cc6a34` — `windowOnly` unless the engine says `atWindow`
(`useSkill`, `resolveAttack`, the Noble Phantasm cancellation), never from a socket payload. Two tests needed the flag and
now name why: `usage-spec.test.mjs` (the prevention table is asked at the window) and `jack.test.mjs` (a source-text
pin).
