---
id: 2026-10-25-covering-servant-offered-evade
found: test
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** A Servant whose shove failed *"cannot Evade the enemy Unit's AoE NP"*, and the card offers only what
the press would pass.
**Actual:** Drake's card still offered `nothing, block, evade`. Pressing Evade warned and did nothing.
**Cause:** `module/apps/chat/cards.mjs:154 @ 901bea6d` — the reaction options came from `promptOptions` alone. The
refusal lives in `answerRung` (`isCovering`), and the card never asked it.
**Fix:** `module/apps/chat/cards.mjs:160 @ 5ed93116` — `refuseCoveredEvade` draws Evade refused, with
`FGT.Cover.CannotEvade` as its hint, from the same `coverStateFor` the press reads. Test:
`test/unit/cover-shove-press.test.mjs`.
