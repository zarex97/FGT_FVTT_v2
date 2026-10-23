---
id: 2026-10-23-invuln-gyakkou-never-counted
found: live press
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** Gyakkou's Invuln (Gyakkou) *"for 1◈ Turns, 1 time"*: one hit spends it (#328 ruling 10).
**Actual:** pressed live 2026-10-23: after the revival it held `uses: 0`, so a hit spends nothing and it lasts its
whole 1◈. Karna's swing was negated and the Invuln stayed.
**Cause:** `packs/_source/abilities/olga-gyakkou.yml:43 @ 7f02a2c2`: I gave the entry `uses: 1`, and a
`noneRefresh` effect takes its charges from its definition (`module/engine/effect-applier.mjs:680 @ 706f5fde`,
`uses: def.uses ?? 0`); an entry's count is read only for `stacking: count`.
**Fix:** `packs/_source/effects/invuln-gyakkou.yml @ 7f02a2c2`: the definition states `uses: 1`.
`olga-328.test.mjs` Gyakkou test asserts the count, red first.
