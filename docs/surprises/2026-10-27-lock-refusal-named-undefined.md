---
id: 2026-10-27-lock-refusal-named-undefined
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Fafnir's lock reads *"Straße/gehen: Schwert cannot be used while Akafiloga Argrise: Fafnir is Active."*
**Actual:** *"Man-made Hero (False) — undefined cannot be used while Akafiloga Argrise: Fafnir is Active"* on every greyed slot.
**Cause:** `module/rules/costs.mjs:299 @ 6ef9ce96` — the `abilityLocked` (and `suppressedCategory`) refusal gave its string `{by}` and no `{name}`.
**Fix:** `module/rules/costs.mjs:299 @ uncommitted` — the detail names the ability; the usage spec carries `name`.
