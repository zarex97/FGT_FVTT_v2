---
id: 2026-10-27-combat-phase-default-claimed-unread
found: retraction
kind: claim-without-reading-the-path
status: fixed
reviewed: false
---
**Expected:** I told the user, in Sieg's grill Q8, that the corpus reads *"at the start of a Combat Phase"* as the
user's own attack, with Karna the one exception (#206 reading 4), and picked that for Schwert and Dead Count usage 2.
**Actual:** Asked for quotations, the built content says the opposite. Karna's identical words, *"Used during your Turn
or at the start of a Combat Phase."*, were ruled any Combat Phase he is in. EMIYA's Reinforcement, *"Used at the start
of a Combat Phase"*, was ruled the same (#208 reading 8). Runner Comet alone takes `combatPhaseStart` only, unruled.
**Cause:** `module/rules/windows.mjs:70 @ 4131dd53` — I took the comment above `defendingPhaseStart` (*"every other 'at
the start of a Combat Phase' in the corpus ... is about the attack its user is making"*) as the rule, without reading
the abilities that use the window. EMIYA's ruling came after that comment and left it stale.
**Fix:** `docs/superpowers/specs/2026-10-27-sieg-clauses.md` @ ab3d28a9 — Q8 re-asked with the quotations and the
pick reversed. The stale comment in `windows.mjs` is corrected when Sieg is built.
