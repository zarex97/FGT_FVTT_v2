---
id: 2026-10-17-magecraft-extended-nothing
found: live press
kind: unknown-value-falls-to-default
status: fixed
reviewed: true
pattern: unknown-value-falls-to-default
---
**Expected:** Player1 pressed Lethal Gunfire Suppression (Suppression to tick 4), then Familiars, a Thaumaturgy Spell:
Magecraft Passive 2 extends Suppression by 1◈, to tick 7.
**Actual:** Suppression still ended at tick 4.
**Cause:** `packs/_source/abilities/kiritsugu-magecraft.yml:45 @ a27e058f` named `DurationExtension`, a standing
element, as a handler action; `module/engine/scheduler.mjs#dispatch` knows `ExtendEffect` and logged
"unhandledAction". `kiritsugu.test.mjs` asserted the authored key, so it passed.
**Fix:** `packs/_source/abilities/kiritsugu-magecraft.yml:48 @ 5101f86f` names `ExtendEffect`;
`module/engine/scheduler.mjs:1521 @ 5101f86f` exports `ACTION_KINDS`, and a test walks every `OnEvent` in the
content against it.
