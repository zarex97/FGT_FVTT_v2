---
id: 2026-11-04-robbing-a-corpse
found: user
kind: rule-word-read-one-way
status: fixed
reviewed: false
---
**Expected:** I picked that a fallen DU still rolls for Insect Eater, because the steal comes *"at the end of the Damage Step"* and the Attack did succeed.
**Actual:** The user: *"She can't rob from a fully dead unit (Basically an unit that will diaspear soon as it is a corpse)"*.
**Cause:** `char_orig_sheets/by-class/Alter Ego/Kazuradrop.md:72 @ 35c9fee5` — I read the timing words alone and never asked what a final defeat leaves behind to take from.
**Fix:** `docs/superpowers/specs/2026-11-04-kazuradrop-clauses.md @ uncommitted` — reading 47: no roll at final defeat, and one that Guts brings back still rolls.
