---
id: 2026-10-22-command-refusal-unnamed
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Player1's Master presses Command Spell on the transformed Gilles and reads *"Command Spells have no
effect on this Servant"*: `FGT.Action.Refusal.uncommandable` was written for it.
**Actual:** "No Command Spell can be spent now."
**Cause:** `module/engine/actions.mjs:253 @ d97795b9` — the bar offers the commands that pass `canSpend` and, with
none left, returns `noCommand`; the gate's own `uncommandable` and its string had no reader on the bar.
**Fix:** `module/engine/actions.mjs:260 @ uncommitted` — `command-spells.mjs#whyNoCommand` names the one reason
holding every command back, said when the bar has words for it; test "its Master's bar says why no Command Spell
is offered".
