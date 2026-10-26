---
id: 2026-10-26-curse-bolg-skips-defeated-holder
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** *"When Cú Chulainn is defeated, Curse (Bolg) is removed from all affected Units"* (#339 ruling 23).
**Actual:** Pressed in War `FwdFxnFteJ3xFCax`: when Cú stayed down the card read *"Lancer stays down, and Curse
(Bolg) comes off Archer."* Medusa, defeated earlier by the same Barbed Spear, still holds it.
**Cause:** `module/engine/scheduler.mjs#endsWithInflicterIntents @ d3452f94` — it walks `ctx.board.units`, and the
board leaves defeated Units out. "All affected Units" asked one reader; the board is the other.
**Fix:** `module/engine/io.mjs#endEffectsWithInflicter @ d3452f94` — the rule moved to the defeat write and walks
every actor in the world and every token's actor (#339 ruling 37); the board-only reader in the scheduler is gone.
Test: a holder with no token loses it too.
