---
id: 2026-10-22-transform-said-as-revival
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Gilles falls with the Spellbook whole and his 10% lands: the card says he becomes the Gigantic Horror,
which stands at 2000 Health.
**Actual:** "Caster is defeated and revived by Prelati's Spellbook: Gigantic Horror, with 500 Health. (rolled 1
against 10%)", then "Caster transforms: ...": a Health that was never his.
**Cause:** `module/engine/revival-report.mjs:37 @ d97795b9` — the revive entry carried the source's restored Health
(`percentOfMax: 100` of his old 500) and nothing of the form it is, so the card read it as any revival.
**Fix:** `module/engine/scheduler.mjs @ 965a7cc5` — the entry carries `transform`, and the card says "{name} does not
fall: {source} takes over instead."; test "the card for the transformation says he becomes it, with no Health of
his own".
