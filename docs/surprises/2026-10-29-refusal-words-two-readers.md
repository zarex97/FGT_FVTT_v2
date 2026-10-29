---
id: 2026-10-29-refusal-words-two-readers
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** a refusal names what it waits on, in the same words wherever it is said.

**Actual:** under Silence the notice read *"cannot be used: Prevented."* while the button read *"Prevented by Silence"*;
every notice ended *"in force.."*; a step out of the Amaterasu Area read *"passes through a panel this Unit may not
enter"*; the Decoy read *"Ruler is the attacker is compelled to attack another unit"*.

**Cause:** `module/apps/actor-sheet/sheet.mjs:665 @ 60958e67`: `refusalWords` worded `prevented` from the bare key, not
from `present.mjs#abilityState`, and kept each key's own full stop; the movement and targeting refusals had no words
for a sealed field or a compulsion's target.

**Fix:** `module/apps/actor-sheet/sheet.mjs:665 @ uncommitted` asks `abilityState` and drops the stop;
`module/rules/movement.mjs:580` names the field; `module/rules/targeting/resolve.mjs:261` names whom the attacker
must attack. The field line re-pressed live; the other two wait on a re-press.
