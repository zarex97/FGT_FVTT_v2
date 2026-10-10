---
id: 2026-10-10-luck-check-before-guts
found: retraction
kind: wrong-order-against-revival
status: fixed
reviewed: false
---
**Expected:** *"If Nemo is defeated while Zero Sail is Active, he performs a Luck Check"* — only a Nemo
who actually dies makes the check; Indomitable's Guts reviving him means no check (#191 reading 9).

**Actual:** the check ran before the revival chain, so one blow could both roll the Luck Check (and
surface or Erase everyone aboard) and then revive him through Guts. Its occupant list read
`platformContentId`, which a dimension never stamps, so a failed check Erased nobody.

**Cause:** `module/engine/attack.mjs:3782 @ 08ea4b1` — ordered "before dying" literally, ahead of the
revival query, and keyed occupants by a footprint the dimension does not have.

**Fix:** `module/engine/attack.mjs:3793 @ d162f50` — the check runs only when `resolveDefeat` returns
his defeat, and occupants are read by Level.
