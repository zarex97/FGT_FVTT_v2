---
id: 2026-10-29-forced-block-answered-nothing
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Aphotic's `ForcedReaction: block` answers her reaction rung, unasked, in the automatic step.

**Actual:** the Process state carried `forcedReaction: "block"` and its history read `["react","nothing"]`; the
breakdown had no Block.

**Cause:** `module/engine/attack.mjs:1744 @ 60958e67`: the declaration answers a reaction rung with no prompt *"nothing"*
itself, before the automatic step runs; `engine/command-spells.mjs` resumes an interrupted rung the same way. Two more
readers of the react rung than the one I changed.

**Fix:** `module/engine/attack.mjs:1744 @ uncommitted`: both paths ask `combat-process.mjs#forcedAnswer` first, as the
automatic step does.
