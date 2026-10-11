---
id: 2026-10-11-round-boundary-turnstart-mislabelled
found: live press
kind: vps-drive-kit
status: open
reviewed: true
pattern: vps-drive-kit
---
**Expected:** A new Round's first Turn logs one `turnStart` naming its own faction with a new tick.
**Actual:** At three Round boundaries the log read `roundEnd: 13`, `turnStart: faction-2 t35`, `roundStart: 14`, `turnStart: faction-2 t35`, `turnStart: t36`. Faction 1's Turn of Round 14 never appears, and one tick is logged twice. Rounds 12 → 13 show `turnStart: t32` then `turnStart: faction-1 t32`.
**Cause:** Not found. The order is re-rolled at each Round boundary (`test/unit` "a Round boundary whose re-roll flips the order"), so Faction 2 leading Round 14 is expected. The audit's `nextTo` helper calls `nextTurn` again when the last `turnStart` it reads is not the faction it wants, so a mislabelled entry makes it skip the real Turn. Whether Foundry or the boundary hook skipped Faction 1 is not settled. See `module/engine/scheduler-hooks.mjs:76 @ f15a3d1`.
**Fix:** Open. Seen only through the helper. Needs a check with one `nextTurn` per Round boundary.
