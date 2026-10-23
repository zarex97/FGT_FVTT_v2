---
id: 2026-10-22-known-np-rolled-again
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** once Gilles learns an NP's True Name, a later use of that NP near him rolls nothing: there is
nothing left to learn.
**Actual:** after "Caster learns the True Name of Nursery Rhyme: A Tale for Somebody's Sake (rolled 9 against
15%)", the next use whispered "Caster does not learn the True Name of the Noble Phantasm Ruler used (rolled 64
against 15%)", an NP his player's Notebook already held.
**Cause:** `module/engine/true-name.mjs:43 @ d97795b9` — `witnessNP` wrote the Notebook page and never read it
back: the roll gate checked radius and tags only.
**Fix:** `module/engine/true-name.mjs:43 @ uncommitted` — skips a witness whose reader's Notebook holds the
NP's key (`notebook.mjs#notebookHolds`); test "an NP already in his player's Notebook: no die, no line".
