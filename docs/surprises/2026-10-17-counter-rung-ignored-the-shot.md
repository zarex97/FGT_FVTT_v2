---
id: 2026-10-17-counter-rung-ignored-the-shot
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Kiritsugu's shot *"cannot be Reacted to unless the AU's AGI Rank is higher"*: Karna (lower) gets no
Block, no Evade and no Counter.
**Actual:** Round 3 tick 8, the shot's card asked Karna *"Counter-attack? Counter Attack back"*, after the react rung
had rightly offered nothing.
**Cause:** `module/engine/attack.mjs#counterAvailable @ a27e058f` asked the Units' own `forbiddenReactions` and
concealment, never the Process's `forbiddenReactions`, where the declaration wrote the shot's refusals. Two readers
of "may this defender Counter".
**Fix:** `module/engine/attack.mjs#counterAvailable @ 5101f86f` adds the Process's own list to `defenderForbids`.
