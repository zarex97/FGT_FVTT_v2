---
id: 2026-10-16-concealment-read-as-stopping-on-units
found: user
kind: rule-word-read-one-way
status: fixed
reviewed: false
---
**Expected:** Presence Concealment's *"Move to any panel regardless of enemy Master-Servant positions"* let a concealed
Unit end its Move on another Unit, as built since `c09981e`.
**Actual:** The user ruled (#226 reading 28) it passes through occupied panels and a guarded Master but never stops on
another Unit, for every holder of Presence Concealment.
**Cause:** `module/rules/movement.mjs:26 @ c09981e` — `IGNORES_BLOCKING` put Presence Concealment beside Huge Scale, and
`canStopOn` read the same list as `canPassThrough`, so "any panel" was read as "any panel, occupied too".
**Fix:** `module/rules/movement.mjs:35 @ uncommitted` — `STOPS_ON_OCCUPIED` holds Huge Scale only and `canStopOn` reads
it; passing and the Master guard still read `IGNORES_BLOCKING`. Pressed live: "The destination panel is occupied."
