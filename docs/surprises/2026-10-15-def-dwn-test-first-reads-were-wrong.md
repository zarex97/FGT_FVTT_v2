---
id: 2026-10-15-def-dwn-test-first-reads-were-wrong
found: test
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** a Normal Attack by Castor on a victim wearing Def Dwn (A) and (C) takes exactly 1 Luck and 1 Agility; a `plainDamage` Process resolves on its own, since it forbids every reaction.
**Actual:** Agility fell by 3 (`expected { luck: 1, agility: 3 } to deeply equal { luck: 1, agility: 1 }`), and the Knockback Process stood at the `react` rung with its health untouched (`expected 750 to be less than 750`).
**Cause:** `module/engine/attack.mjs:1156 @ 7231295` — two things I had not read. A hit of 100 or more is also an Injury Roll, which spends Agility of its own (Medea 8 → 6 with no Def Dwn on her); and a `plainDamage` declaration only forbids the rungs, the card still asks the defender for its one answer, "nothing" (`pendingPrompt` lists the buttons, the forbidden ones are filtered by the card).
**Fix:** `test/unit/dioscuri-209-arena.test.mjs @ uncommitted` — each strike is played twice with the same dice, the victim bare and wearing both, and the drain is the difference; the Knockback Process is played out with `playProcess`.
