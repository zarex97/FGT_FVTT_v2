---
id: 2026-10-23-damage-dealt-fired-on-zero
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: qualifier-quoted-not-checked
---
**Expected:** Dracula Vlad's two-target Attack (R53): the Master he hit for 266 heals him 100 and 1; Chiron's hit,
"0 — Negated by Invuln", heals nothing: *"(no effect if no damage is dealt)"*.
**Actual:** Health 800 → 1212 = 312 (the kill) + 100 too many; the log held two `damageDealt` events for tick 157.
**Cause:** `module/engine/attack.mjs:3228 @ 630495df` — `damageDealt` fires on every hit a rider lands on, a 0 included,
and its options never carried `attack:dealtDamage` (the `damageTaken` and Process-end sets did). My handlers had no
guard: Dracula's heal and Kazıklı's stack.
**Fix:** `module/engine/attack.mjs:3228 @ 2f18de06` passes `dealtDamage`; both handlers ask `attack:dealtDamage`.
