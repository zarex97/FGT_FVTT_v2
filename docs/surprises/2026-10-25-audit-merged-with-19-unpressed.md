---
id: 2026-10-25-audit-merged-with-19-unpressed
found: user
kind: live-client-only
status: fixed
reviewed: true
pattern: live-client-only
---
**Expected:** By the lesson *"Every Clause ends Pressed or Observed live: a case the board does not produce by chance is
staged and pressed, never left to a test"*, Arturia (Lancer)'s audit closes with all 100 Clauses Pressed or Observed.
**Actual:** PR #337 merged with 81. Eighteen were left as "shared files pressed before" or "unit-tested only": Magic
Resistance (8), Riding's Passives (6), Vivian's Blessing, Charisma's Skill Seal, WH.round.nostack, IA.u2.notmag. The
user asked why: *"Wait, why only 81 of 100, what happened to the other 19?"* RH.go is the nineteenth, not built by
ruling 6.
**Cause:** I treated a shared file pressed in another Servant's audit as pressed for her, and reported the shortfall as
a count rather than as work left; the tracker line was ticked on 81.
**Fix:** The 18 staged and pressed on her live board on 2026-10-25 (the Clause file's second press log): 99 of 100,
RH.go not built. A Clause a shared file carries is pressed on the Servant under audit; the tracker is ticked only then.
