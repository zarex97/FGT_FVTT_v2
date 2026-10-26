---
shape: Element
parent: Ability, Effect
code: module/rules/authoring/elements.mjs, module/rules/elements.mjs
---
**What it is:** a standing rule an Ability or an Effect carries while it is in force. 69 executors.

**Fields:** one per executor. Only the ones the survey changed are listed here.
- `RankShift.target` (**Variant** `parameter`, Saber 2026-10-21): it shifts an Ability's Rank (Penthesilea), and a
  Parameter's (Kiritsugu, `to: EX`; corrected 2026-10-22). Richard I's Godspeed raises AGI one step per token, B to EX. Richard of
  Lionheart treats AGI as A, or EX, during Combat, and gains a `+` on STR at AGI A. Two sheets raise MAG to Rank B.
  The Rank feeds Max Agility, Evade rolls and Base Attack. Takasugi Shinsaku's Kihei buffs raise a Parameter one Rank
  each, with a `+` past Rank A (Archer). **Per token runs since #319**: `to: {ladder, count}` walks the sheet's own
  ladder one rung per count (Godspeed's B > B+ > B++ > A > A+ > A++ > EX skips A-- and A-), and `steps` or `grades`
  may be `{count, max}`. Lionheart's in-Combat shift is not run, #284.
  keys: `element.RankShift.parameter`, `element.RankShift.to`, `element.RankShift.steps`; during Combat: none (#284)

- `AttackRankTier` (**Shape** member, Saber 2026-10-26): Siegfried's Armor of Fafnir, a Total cut that nullifies an
  attack at or under a Rank: the attacker's Parameter for the damage type, or an NP's own Rank. Andreias Amarantos's
  sibling. `Defenceless` (from behind, every reduction off) and `WoundsMaxHealth` (the Health a hit took off the
  maximum) came with it. **Run since #341.**
  keys: `element.AttackRankTier`, `element.Defenceless`, `element.WoundsMaxHealth`

**Kin:** Saber: R149, R354, R391, R400, K338, 4 sheets.
