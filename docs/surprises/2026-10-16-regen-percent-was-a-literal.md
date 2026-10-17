---
id: 2026-10-16-regen-percent-was-a-literal
found: test
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Arjuna's Regen heals 15% and Van Gogh's two Regens 5%, each the magnitude their ability states
(#234 reading 6).
**Actual:** `regen.yml` healed `percentOfMax: 10` whatever the instance said: Van Gogh's `magnitude: 5` was stored
on the instance and read by nobody, so her Regens healed 10%. Made `"@magnitude"`, a Regen staged with no
magnitude then healed nothing (`expected [] to deeply equal [ 125 ]`).
**Cause:** `packs/_source/effects/regen.yml:38 @ uncommitted` — a literal where the sheet's figure belonged, and
`resolveRuleValues` substituted no `percentOfMax` on a `then` action.
**Fix:** `module/rules/snapshot.mjs:1653 @ uncommitted` — the action's percent resolves against the instance;
`defaultMagnitude: 10` on the definition, read by landing and by the projection for an instance that states none.
