---
id: 2026-10-18-reanswered-rung-dealt-damage-twice
found: tooling
kind: write-before-store
status: fixed
reviewed: true
pattern: write-before-store
---
**Expected:** a rung answered once deals its damage once, even if the GM's client reloads while the run waits on a later window.
**Actual:** Rain of Light's Processes wrote Kingprotea's damage, then waited 45s on the Command Spell and Counter windows. I reloaded the GM page twice and answered `react` again each time: Kingprotea went 1700 → 986 → 487 and Jack, hit again too, was killed.
**Cause:** `module/engine/attack.mjs#advanceAttack @ dfcaa421` — a Process stores its state only when its run ends. The damage is written mid-run, so a run lost with the client leaves the card at `react`, and the next answer runs the damage again.
**Fix:** `module/engine/attack.mjs:2159 @ uncommitted` — a rung that writes to a Unit (damage, the Heel's roll, the Injury) stores the Process at once; `module/engine/attack.mjs:2105 @ uncommitted` — `resumeStalledProcesses` drives on what a lost run left, on the GM's load (#250). Pressed live 2026-10-19: Medea's Normal Attack on Yan Qing, the GM reloaded in the Injury window; the Process resumed, Health 338 → 107 once, Agility 15 → 14 once, `done`.
