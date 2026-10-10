---
id: 2026-10-10-first-apply-runs-after-damage
found: live press
kind: authored-order-is-not-timing
status: fixed
reviewed: true
pattern: hidden-timing-rule
---
**Expected:** Great Ram Nautilus — *"When this NP is used, first apply … NP DmUp … Then, deals 4x damage"* —
counts its two NP DmUps (30% and, on Waterside, 20%) in its own damage. The YAML lists the
`applyEffects` phase first and says the order is load-bearing.

**Actual:** stage 4 read only Heracles' Mad Enhancement Def Up; the three buffs were listed on the card
after the damage, expiring that Turn.

**Cause:** `module/engine/attack.mjs:4682 @ 08ea4b1` — a phase runs before the damage only when it states
`when: beforeDamage`; unstated means after, wherever it is listed. Anastasia's Snegleta has the same
shape: its *"First, inflict Def Dwn (A)"* missed its own hit.

**Fix:** `packs/_source/abilities/nemo-great-ram-nautilus.yml`, `anastasia-snegleta.yml @ d162f50` —
`when: beforeDamage`; `test/unit/storm-border-191.test.mjs` refuses any effect phase listed before a
damage phase without a `when`.
