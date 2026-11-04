---
id: 2026-11-04-empty-aim-is-no-unit-not-no-legal-target
found: user
kind: rule-word-read-one-way
status: fixed
reviewed: false
---
**Expected:** The grill round on the empty swing asked whether an area Attack may be aimed *"where no legal target stands"*. It also said no ability uses `targetsRequired: false`.
**Actual:** The user: *"No, no where there are no Legal Targets, but where there are No Targets at all, or not visible ones."* A visible Unit that cannot be hit still refuses the aim. `RIDE_SPEC` does use the key: *"A ride that reaches nobody is legal, and spends the action."*
**Cause:** `module/rules/targeting/resolve.mjs:786 @ cf8afdb0` — the question was worded from the refusal's message, *"No legal targets"*, and not from what the aimer sees. The key's users were grepped in `packs/_source` alone, and `module/rules/movement.mjs:350 @ cf8afdb0` was not looked at.
**Fix:** `docs/superpowers/specs/2026-11-02-gilgamesh-clauses.md @ uncommitted` — ruled as the user worded it, the Empty Aim of `CONTEXT.md`; the build has its own issue.
