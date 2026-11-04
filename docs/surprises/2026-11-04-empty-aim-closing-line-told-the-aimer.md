---
id: 2026-11-04-empty-aim-closing-line-told-the-aimer
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** An Empty Aim reads the same to its user whether the area holds nobody or a Unit they cannot see.
**Actual:** Player1 read *"Gate of Babylon: King's Treasure strikes nothing."* only when the area truly held nobody. With a concealed Unit caught, that line never came, so its absence told them someone was there.
**Cause:** `module/engine/attack.mjs @ 2841096d` — the close of an empty use posted a line of its own, written for the path with no Process and never held against the path with a hidden one.
**Fix:** `module/engine/attack.mjs @ 2841096d` — one line for both, *"no Unit is seen in the area"*, the closed Process riding on it; pressed both ways as Player1.
