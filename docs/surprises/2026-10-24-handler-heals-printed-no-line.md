---
id: 2026-10-24-handler-heals-printed-no-line
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Dracula Vlad's Attack on a Civilian and Assassin 1 (R55) says what it paid him: 100 and 1 for the
Civilian (Ch. 06), 100 and 1 for the hit, 25% for the kill.
**Actual:** Health 700 → 1212 and Agility 8 → 15, as ruled, but the cards said only "Civilian A is defeated by
Lancer." and one row, "Agility 14 → 15". No Health line for any of the three heals, nor for the felled Unit's
Agility. The R52 press counted the heal off his sheet and never saw that no card said it.
**Cause:** `module/engine/applier.mjs:137 @ uncommitted` — a batch's `lines` said clocks, stats, spans and
removals, never a `heal`. The defeat batch (`attack.mjs#applyDamage`) and the Civilian kill (`attack.mjs:383`)
asked for no lines at all, so every Servant's kill and drain heal was silent.
**Fix:** `module/engine/applier.mjs#healLines @ uncommitted` — each heal is the turn report's line, by public
name and source, as given against the maximum. The defeat batch's lines go on the attack card. The Civilian kill
posts them under its defeat card (`defeat-card.mjs#postLinesCard`). `EffectRegistry.nameOf` names a source for
both readers.
