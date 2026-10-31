---
id: 2026-10-31-extension-card-names-only-the-span
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** SF.11: extended, her Skill Cooldowns −1◈ and her next Attack ×2; every write said.
**Actual:** '… Shisarot Form is extended by 3◈ Turns.' and nothing of Riding 5→1, Shiisaa Beam 3→0 or the Charge (tick 18).
**Cause:** `module/engine/effect-extension.mjs:94 @ 7b1e3c86` — the `then` batch ran with no lines.
**Fix:** `module/engine/effect-extension.mjs:105-120 @ fd0d2bbe` — lines whispered to her side; unit-tested, not yet re-seen live.
