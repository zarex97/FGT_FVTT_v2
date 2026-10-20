---
id: 2026-10-20-blind-evade-counted-twice
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Blind, clause 2: *"Evade rolls are increased by 3"*, once (Clause `WM.p.own`, her own Blind kept while Watermelon exempts only the Miss).
**Actual:** Process 7hnRtZkk9FXbX2QS, Karna's Normal Attack on the Blind Anastasia, Player1 Evaded: modifiers *"Blind 3"* and *"blind 3"*, +6.
**Cause:** `module/engine/attack.mjs:4506 @ 50eae993` — `evadeModifiers` added Slow's +2 and Blind's +3 by hand, from before the rule elements ran; `slow.yml` and `blind.yml` author the same modifiers, which reach the roll through the defender's check plan. Blind's Eye of the Mind and Clairvoyance exemptions never touched the hand-written copy.
**Fix:** `module/engine/attack.mjs#evadeModifiers @ uncommitted` — the two lines go; Immobilize, which authors none, stays. `anastasia-258-rulings.test.mjs` *"adds +3 once"*, red before.
