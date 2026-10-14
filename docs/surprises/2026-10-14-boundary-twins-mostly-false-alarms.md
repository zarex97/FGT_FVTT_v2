---
id: 2026-10-14-boundary-twins-mostly-false-alarms
found: retraction
kind: hidden-timing-rule
status: wontfix
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** six readers that build a board from the live clock during a Round's end were twins of #199 and would each give a wrong answer: the applier's six `currentBoard()` calls, `fields.runUpkeep`, `fields.expireFields`, `resetFieldWindows`, the defeat chain (`io.defeatIfLethal`, `resolveDefeatOf`), and the game log.
**Actual:** played through a real Round 9 → 10 boundary in the test world, all six do read Round 10. Only the game log's answer changed (`2026-10-14-round-end-logged-under-next-round`). The rest read no Round Record, which is all the Round changes on a projected Unit: its Tick is still the ended one until `globalTurn` advances. The only Round Record readers are `rules/costs`, `rules/reactions`, `rules/environment`, `rules/platforms` and `rules/modes`, and none is on these paths. `resetFieldWindows` opens the new Round's window on purpose.
**Cause:** `module/engine/applier.mjs:131 @ 46d0edc` and the others — the claim was made from the shape (a live board at a boundary) without checking what each path reads off it.
**Fix:** none needed. `test/unit/clock-reads.test.mjs` keeps the count of direct clock reads from growing, so a new reader cannot join them unnoticed.
