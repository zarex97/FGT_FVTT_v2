---
id: 2026-10-23-drake-kiritsugu-held-no-class
found: test
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** after Van Gogh's fix (`2026-10-22-van-gogh-held-no-class`), every built Servant states
`servantClasses`, the field every Class rule reads.
**Actual:** `drake.yml` and `kiritsugu.yml` stated only `classContainer`. Nothing refused them. Read from
the code, not pressed: Kiritsugu's NP gate opened at Round 6, not an Assassin's Round 4
(`rules/np-gate.mjs#baseGateRound`). His Zone of Notice took the default radius, not the Assassin's
(`rules/zon.mjs`). A random fill drew both for the `EXTRA` slot (`rules/war-setup.mjs#candidatesFor`).
**Cause:** `tools/lib/content.mjs:1315 @ b6c19978`. The build checked a Servant's class image, not that it
held a Class. Van Gogh's fix mended one sheet and swept no others.
**Fix:** `tools/lib/content.mjs#servantHoldsAClass @ 74abd056`. `validate:content` now refuses a Servant
with no `servantClasses`, or one naming an unknown Class. Both sheets gained their Class, read from the
sheets' `by-class/` folders: Rider and Assassin. `content.test.mjs` was red first.
