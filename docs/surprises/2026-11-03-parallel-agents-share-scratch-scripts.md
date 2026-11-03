---
id: 2026-11-03-parallel-agents-share-scratch-scripts
found: tooling
kind: shared-working-copy
status: fixed
reviewed: false
---
**Expected:** sixteen classifier subagents, each handed its own batch file, read only their batch.
**Actual:** they share the session scratchpad, wrote print scripts under the same names (`p.py`), and
overwrote each other's. Five noticed and re-read their rows. Two did not: Assassin-part1 and
Berserker-part2 came back with rows #20 onward carrying quotes from another batch (*"Asterios is
grateful to Thesseus for killing him"* on Charles-Henri Sanson | Napoleon).
**Cause:** `tools/relations/CLASSIFY.md:1 @ 926266f` — the brief named each agent's input and output but
not a private working directory; a shared scratch path is a shared working copy.
**Fix:** `tools/relations/validate.py:1 @ uncommitted` — every classified row is checked against its own
input pair, and its quote against that pair's own entries, so a wrong-batch read fails by name; the two
batches are redone, and the brief now names a private directory per agent.
