---
id: 2026-10-15-rest-of-that-turn-ran-a-third
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** Kanshou & Bakuya's Magic Resistance Rank C lasts "for the rest of that Turn".
**Actual:** at Faction 2's Turn (tick 5) after his swing at tick 4, the board still read Rank C.
**Cause:** `packs/_source/abilities/emiya-kanshou-and-bakuya.yml:46 @ 960496f` (and Overedge's copy) — authored ⅓◈, which runs through the next tick.
**Fix:** `emiya-kanshou-and-bakuya.yml`, `emiya-overedge.yml @ 3cc6a34` — `until anyTurnEnd` (the code review found `turnEnd` is heard by the active faction alone, so a guard from a Counter in the enemy's Turn would outlive it); re-pressed on his own Turn: gone at tick 15, Rank D.
