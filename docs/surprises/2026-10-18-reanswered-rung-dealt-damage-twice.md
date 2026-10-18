---
id: 2026-10-18-reanswered-rung-dealt-damage-twice
found: tooling
kind: check-then-act-race
status: open
reviewed: false
---
**Expected:** a rung answered once deals its damage once, even if the GM's client reloads while the run waits on a later window.
**Actual:** Rain of Light's Processes wrote Kingprotea's damage, then waited 45s on the Command Spell and Counter windows. I reloaded the GM page twice and answered `react` again each time: Kingprotea went 1700 → 986 → 487 and Jack, hit again too, was killed.
**Cause:** `module/engine/attack.mjs#advanceAttack @ dfcaa421` — a Process stores its state only when its run ends. The damage is written mid-run, so a run lost with the client leaves the card at `react`, and the next answer runs the damage again.
**Fix:** open. Out of #249's scope. Storing the state after the damage write, or a written-damage marker the rung checks, would close it.
