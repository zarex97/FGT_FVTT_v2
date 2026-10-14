---
id: 2026-10-14-gate-blocked-by-the-grant
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Gate of Skye *"cannot be used if ... Wisdom of Dún Scáith ... [is] on Cooldown"*, so a Wisdom slot still cooling refuses it.
**Actual:** The requirement names `scathach-wisdom-of-dun-scaith`, the grant, which has no clock. `gatedAbilities` matches that id only, so a cooling slot never blocks the Gate. Its `alsoTriggers` on the same file had been fixed to name the group, `{exclusionSet: wisdomOfDunScaith}`.
**Cause:** `packs/_source/abilities/scathach-gate-of-skye.yml:35 @ da0dc77` — one sentence, "Wisdom of Dún Scáith", read as the group by `alsoTriggers` and as the grant by `requirements`.
**Fix:** `packs/_source/abilities/scathach-gate-of-skye.yml:32 @ uncommitted` — a second `abilityOffCooldown` names the `wisdomOfDunScaith` set; pressed live, a cooling copy alone greyed the Gate (#204 reading 19).
