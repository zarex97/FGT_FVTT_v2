---
id: 2026-10-17-crest-silence-one-action
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** a Silenced Master cannot use its Magic Crest, a Damage Spell (#241 reading 14, authored
`isSpell: true`).
**Actual:** live, the Master of Rider of Faction 1 under Silence: `canUseAbility` → `{ok: true}`.
**Cause:** `module/rules/costs.mjs:634 @ b0313abf` — the Seal gate asked one action per ability,
and `categorizedAsNP` answered `np` before `isSpell` was asked. An ability that is two things was read
as the first.
**Fix:** `module/rules/costs.mjs#preventionActionsFor @ b0313abf` — every action the ability is, and a
Seal on any of them refuses it.
