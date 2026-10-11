---
id: 2026-10-11-negative-tick-throws-mid-process
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** Raikou's Normal Attack with the 'Raikou' buff lands on Medusa, takes ⅓◈ off both Noble Phantasms, and the Combat Process moves on.
**Actual:** "Do nothing" applied the damage, and the Process stayed at `react`. Each further click applied it again, and Medusa went 750 → 163 → 0. Console: `FGT | Empty term in "-⅓◈".`
**Cause:** `packs/_source/effects/raikou-buff.yml:57 @ f15a3d1` authored `ticks: "-⅓◈"`, but `CooldownDelta` already negates `ticks` and `parseTick` cannot read a sign. The throw escaped `fireEvent("damageDealt")` in `module/engine/attack.mjs:2329 @ f15a3d1` after the damage was written and before the state was saved. `test/unit/raikou.test.mjs` asserted the string itself.
**Fix:** `packs/_source/effects/raikou-buff.yml @ b9884b9` uses "⅓◈", and a throwing `damageDealt` handler is now reported instead of aborting the Process. `test/unit/content-ticks.test.mjs` parses every authored `ticks` in the corpus.
