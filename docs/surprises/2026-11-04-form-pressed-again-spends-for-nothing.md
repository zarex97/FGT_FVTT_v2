---
id: 2026-11-04-form-pressed-again-spends-for-nothing
found: live press
kind: generic-path-escapes-special-case
status: fixed
reviewed: true
pattern: generic-path-escapes-special-case
---
**Expected:** A Form with no way out has nothing left to press.
**Actual:** `useSkill` on the Form, in Form with 7 Tokens: `{ok: true}`, Eater Tokens 7 to 0, *"1 effect(s) applied"*.
**Cause:** `packs/_source/abilities/kazuradrop-atomicros-form.yml:18 @ ff814c4b` — I closed the toggle with `cannotDeactivate` and left the use open, its one requirement the Tokens.
**Fix:** `packs/_source/abilities/kazuradrop-atomicros-form.yml @ 96edc10a` — `modeInactive` on her own mode. My reading: the sheet does not say a second entry is refused.
