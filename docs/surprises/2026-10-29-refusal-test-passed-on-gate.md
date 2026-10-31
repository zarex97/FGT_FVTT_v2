---
id: 2026-10-29-refusal-test-passed-on-gate
found: test
kind: passes-for-the-wrong-reason
status: fixed
reviewed: true
pattern: passes-for-the-wrong-reason
---
**Expected:** a test that Dainisshō is refused with no Amaterasu Area proves the `fieldOpen` requirement.

**Actual:** `expect(verdict.ok).toBe(false)` passed; asked for its reason it read *"round"*: the NP gate refused the
Spell categorized as NP before the requirement was asked.

**Cause:** `test/unit/tamamo-353.test.mjs:396 @ ebad7a6b`: `canUseAbility` was handed no board and the default
gate, and the check asserted only that it failed.

**Fix:** `test/unit/tamamo-353.test.mjs:396 @ ebad7a6b`: the board and an open gate are passed, and the reason
`fieldOpen` is asserted.
