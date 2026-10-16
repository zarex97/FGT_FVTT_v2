---
id: 2026-10-16-cut-after-the-phase-said-nowhere
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Excalibur hits Scáthach and Medusa and its Cooldown takes ⅓◈ off per Unit affected, and a player reads the cut (#230 EX.cut; the #209 lesson, "a cut a handler makes is said where a player reads it").
**Actual:** the clock went 23 → 21 and neither card, nor any other message, said so; the log held only "event: Arturia attackPerformed".
**Cause:** `module/engine/attack.mjs:3036 @ 9d0ab57` — `fireAttackPerformed`, which I built for this audit, applied its intents with a bare `applyBatch`; the Damage Step's handlers go through `applyWithCooldownLines` and print the line (#209), and the event raised after the Phase was a second writer of a cut with no reader.
**Fix:** `module/engine/attack.mjs#fireAttackPerformed @ 9d0ab57` — through `applyWithCooldownLines`, the rows appended to the attacker's last card of the Phase. Utopia's cut prints the same way; the arena test reads "Strike Air: Hammer of the Wind King: Cooldown 10 → 9" off the card.
