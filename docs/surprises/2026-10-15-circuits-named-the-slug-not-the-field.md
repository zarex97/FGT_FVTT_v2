---
id: 2026-10-15-circuits-named-the-slug-not-the-field
found: test
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** AC.ubw and BC.ubw (`self:inField:unlimitedBladeWorks`) fired on a hit inside the Reality Marble; only a
miss was missing (reading 10).

**Actual:** they never fired, hit or miss. Inside a real field region, a Normal Attack moved no Luck and no cooldown, and
BC's +50 was absent from the breakdown. `validate:content` called the option well formed.

**Cause:** `packs/_source/effects/activated-circuits.yml:37 @ 7231295` — a field's id is its ability's content id
(`engine/fields.mjs:223`: `fieldId: ability.system?.contentId`), `emiya-unlimited-blade-works`; `unlimitedBladeWorks` is
the slug. Every other `inField:` in the corpus names a content id; only these two were wrong.

**Fix:** both Circuits name `emiya-unlimited-blade-works` (`activated-circuits.yml:51 @ 3cc6a34`), and
`test/unit/in-field-names.test.mjs @ 3cc6a34` fails for any `inField:` that is not the content id of an ability that
opens a field.
