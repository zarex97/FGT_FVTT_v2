---
id: 2026-10-24-phase-change-lines-reached-no-card
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Round 2 begins at Day and a card says Dracula is taken off Vlad III (Berserker).
**Actual:** Dracula was removed and the log read `phaseChanged … source: dracula`. Player1's chat showed only
"Round 2 begins at Day."
**Cause:** `module/engine/round-phase.mjs:72 @ 4f6f04ab` asked `applyWorldIntents` for `lines: true` and dropped
the lines it returned. No handler had listened to `phaseChanged` before, so nothing it did was ever said.
**Fix:** `module/engine/round-phase.mjs:72 @ 9d40169a` posts the batch as a card titled "The Round turns to Day"
or "Night" through `turn-report.mjs#postTurnEndReport`, with the batch's lines.
