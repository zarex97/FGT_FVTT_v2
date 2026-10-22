---
id: 2026-10-21-members-sorted-by-keyword
found: user
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** On the first Saber survey I read the open groups and residue, but I gave most Member verdicts
by a keyword match and a pre-sort. A Clause with *"Cooldown:"* was a Cooldown, and *"applies X"* with a known X was
an Effect. I clipped long Clauses at 200 to 360 characters. I reported *"Most of those were sorted by keyword, not
read in full"* and took it as cheap and good enough.

**Actual:** The user, 2026-10-21: *"They should be read fully."* Reading all 983 groups in full turned up five gaps
that the keyword pass had filed as Members. The engine has no Class option (#286), no War without Day or Night
(#287), no mode extension or count end (#288), no hidden statblock (#289) and no summon split (#290). It also
found three more outcome-sized cooldowns (#285).

**Cause:** `.claude/skills/survey-class/SKILL.md @ 3530fb5b` step 2 said *"Judge a group by its head"*. It did not
forbid a keyword lead, and `tools/sheet-kin.mjs` clipped what it showed. A keyword names the Shape a Clause
mentions, not whether the engine runs it.

**Fix:** the skill now says every group, Members included, is read in full. A verdict never comes from a keyword
or a pre-sort. `tools/sheet-kin.mjs` no longer clips a Clause. Saber's ledger was rebuilt from the full reading.
