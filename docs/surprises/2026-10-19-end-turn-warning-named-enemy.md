---
id: 2026-10-19-end-turn-warning-named-enemy
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Red's player reads Blue's Lancers as "Lancer of Blue" on every surface, as the cards do (closed information on).
**Actual:** Player1's turn panel, Round 1 of *Heracles Audit*: *"Scáthach must pick the two Skills Wisdom of Dún Scáith copies before this Turn ends."* and *"Karna must choose which effect a Skill starts with before this Turn ends."*
**Cause:** `module/rules/budget.mjs:609 @ d64553fc` — `copyPicksOwed` and `openingChoicesOwed` read the whole board (#204 reading 8, #206 reading 3), so the other side's owed choice blocks this side's Turn, and their message, marked `fgt-name-ok` for "the acting player about their own Unit", printed `u.name` and the Skill to whoever acted.
**Fix:** `module/apps/hud/turn-panel.mjs:118 @ ded45740` — `forViewer` names a Unit the viewer does not own by `shownNameById` and leaves the Skill out (`FGT.HUD.UnmetOther`), for the panel and the refused press alike. `test/unit/end-turn-warning-names.test.mjs`.
