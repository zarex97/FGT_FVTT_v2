---
id: 2026-11-04-grill-read-a-missing-duration-as-no-clock
found: user
kind: rule-word-read-one-way
status: fixed
reviewed: true
pattern: rule-word-read-one-way
---
**Expected:** Gilgamesh's Q7 recommended that Gate of Babylon's *"6. Freeze"* and *"12. Sleep"*, printing no Turns, stay untimed: other sheets print Freeze untimed, and `freeze.yml` has no default duration.
**Actual:** The user: *"They do have timers, unlike poison and curse, normally stated as Stun. Typo, put them for 1◈."* Curse and Poison are stages and run until removed; a status that stops a Unit Acting has a clock, like the rows around it. The same round's Q13 was a typo too: *"the missing 'next to' Is a typo."*
**Cause:** `docs/superpowers/specs/2026-11-02-gilgamesh-clauses.md:116 @ 0f738632` — the reading grouped the four rows by what they leave out, and did not ask what kind of effect each is. The row's neighbours were the better kin.
**Fix:** `packs/_source/abilities/gilgamesh-gate-of-babylon.yml @ 2ea23521` — Freeze, Sleep, Crystalfreeze and Nightmare at 1◈, each extended by a repeat; pressed: two 6s tick 4 → 10, three 6s tick 4 → 13.
