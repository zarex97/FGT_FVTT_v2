---
id: 2026-10-28-evaded-attack-skips-self-phase
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** Ruling 8: Haradhanu Janaka's "Next, apply Heal Up ... to Sita" lands whether or not the DU Evades.
**Actual:** Medea's Master Evaded the NP; the Process went noDamage → done and Sita had no Heal Up.
**Cause:** `module/engine/attack.mjs:4545 @ a17cfa57` — an after-damage `target: self` phase runs only from the damage step; a missed or Evaded Process never reaches it.
**Fix:** `module/engine/attack.mjs:4545 @ a17cfa57` — a phase may say `alsoOnMiss`; `selfPhasesOnMiss` runs it once per group on `missed` and `noDamage`, on the card. Live: Evade success, "Heal Up" on the card, healUp 50 on her.
