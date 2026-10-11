---
id: 2026-10-11-boundaries-skipped-after-reload
found: live press
kind: vps-drive-kit
status: open
reviewed: true
pattern: vps-drive-kit
---
**Expected:** Each `nextTurn` runs one Turn boundary and logs one `turnStart`, as it does on a page that has been up a while.
**Actual:** Twice, the first `nextTurn` calls within about 20 s of a page reload advanced Foundry's Turn with no boundary run. Round 9's GM Turn went to Round 10's GM Turn, and the log shows `turnStart: t25` then `turnStart: t26` with no Faction 1 or 2 Turn, no `roundEnd: 9` and no `roundStart: 10`.
**Also:** About 45 s after another reload, Usui's defeat switched Tenmōkaikai off but `onModeEnded` did nothing: copies stayed and the cooldown read 0. Called by hand, the same hook dismissed them and set 22. The same press with no fresh reload worked.
**Also:** Timing boundaries on both branches (2026-10-11), the first `nextTurn` after each fresh reload, with a 60 s wait, hung past 120 s. Every later one landed in 2–6 s. So the wait does not cure it.
**Cause:** Not found. `module/engine/scheduler-hooks.mjs:106 @ f15a3d1` — `onTurnChange` returns early on `isScheduler()` or `claimBoundary`, and `onModeEnded` on `activeGM.isSelf`. A stale pre-reload connection may still count as the GM's.
**Fix:** Open. Seen only right after a reload. A later `nextTurn` with no reload logged its boundary normally.
