---
id: 2026-10-25-attack-refusal-names-the-id
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** Player1 pressing Arturia (Lancer)'s Mana Burst after Torrent of Light in the same Round is refused in
the sheet's words: *"Cannot be used on the same Round as Torrent of Light."*
**Actual:** *"FGT | Cannot use this ability: Cannot be used on the same Round as lanceturia-torrent-of-light"*. The
sheet named the ability; the attack path printed its content id.
**Cause:** `module/engine/attack-preflight.mjs#usageRefusal @ 82b7d864` formatted `FGT.Ability.Refused.<reason>` with
the gate's raw `detail`, whose `partner` is a content id; `apps/actor-sheet/present.mjs` maps it to a name and the
attack path did not.
**Fix:** `module/engine/attack-preflight.mjs#usageRefusal @ 0ce2a0b1` names the partner from the attacker's items, as
the sheet does; `test/unit/lanceturia-336.test.mjs` asserts the formatted name.
